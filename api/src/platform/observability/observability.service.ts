import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';
import { Client } from 'pg';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Queue } from 'bullmq';
import { RequestContextService } from '../request-context/request-context.service';
import { getActiveTraceContext } from './tracing';

const PG_INSTRUMENTED = Symbol.for('nest-template.pg.instrumented');
const PG_CONNECT_INSTRUMENTED = Symbol.for('camille.pg.connect.instrumented');
const DB_POOL_INSTRUMENTED = Symbol.for('camille.db.pool.instrumented');
const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 250;

type DbPoolStatus = 'active' | 'idle' | 'waiting' | 'pending_create';
type DbPoolOperationStatus = 'ok' | 'error';
type InstrumentableDbPool = {
  [DB_POOL_INSTRUMENTED]?: boolean;
  numFree: () => number;
  numPendingAcquires: () => number;
  numPendingCreates: () => number;
  numUsed: () => number;
  on: (
    eventName: 'acquireRequest' | 'acquireSuccess' | 'acquireFail',
    handler: (...args: unknown[]) => void,
  ) => void;
};

@Injectable()
export class ObservabilityService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal = new Counter({
    name: 'app_http_requests_total',
    help: 'Total number of completed HTTP requests.',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });
  private readonly httpRequestDurationSeconds = new Histogram({
    name: 'app_http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });
  private readonly dbQueriesTotal = new Counter({
    name: 'app_db_queries_total',
    help: 'Total number of PostgreSQL queries executed.',
    labelNames: ['operation', 'status'],
    registers: [this.registry],
  });
  private readonly dbQueryDurationSeconds = new Histogram({
    name: 'app_db_query_duration_seconds',
    help: 'PostgreSQL query duration in seconds.',
    labelNames: ['operation', 'status'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [this.registry],
  });
  private readonly dbPoolClients = new Gauge({
    name: 'app_db_pool_clients',
    help: 'PostgreSQL pool clients and pending work grouped by pool state.',
    labelNames: ['state'],
    registers: [this.registry],
  });
  private readonly dbPoolAcquireTotal = new Counter({
    name: 'app_db_pool_acquire_total',
    help: 'Total number of PostgreSQL pool acquire attempts.',
    labelNames: ['status'],
    registers: [this.registry],
  });
  private readonly dbPoolAcquireDurationSeconds = new Histogram({
    name: 'app_db_pool_acquire_duration_seconds',
    help: 'Duration spent waiting to acquire a PostgreSQL pool client.',
    labelNames: ['status'],
    buckets: [0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });
  private readonly dbPoolConnectTotal = new Counter({
    name: 'app_db_pool_connect_total',
    help: 'Total number of physical PostgreSQL client connection attempts.',
    labelNames: ['status'],
    registers: [this.registry],
  });
  private readonly dbPoolConnectDurationSeconds = new Histogram({
    name: 'app_db_pool_connect_duration_seconds',
    help: 'Duration spent establishing physical PostgreSQL client connections.',
    labelNames: ['status'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });
  private readonly redisConnectionErrorsTotal = new Counter({
    name: 'app_redis_connection_errors_total',
    help: 'Total number of Redis connection errors observed by the app.',
    labelNames: ['component'],
    registers: [this.registry],
  });
  private readonly bullMqJobCount = new Gauge({
    name: 'app_bullmq_jobs',
    help: 'BullMQ jobs grouped by queue and state.',
    labelNames: ['queue', 'state'],
    registers: [this.registry],
  });
  private bullMqQueue?: Queue;
  private dbPool?: InstrumentableDbPool;
  private readonly logQueries: boolean;
  private readonly slowQueryThresholdMs: number;

  constructor(
    @InjectPinoLogger(ObservabilityService.name)
    private readonly logger: PinoLogger,
    private readonly requestContextService: RequestContextService,
  ) {
    this.logQueries = process.env.DB_LOG_QUERIES === 'true';
    this.slowQueryThresholdMs = Number(
      process.env.DB_SLOW_QUERY_THRESHOLD_MS ?? DEFAULT_SLOW_QUERY_THRESHOLD_MS,
    );
    this.registry.setDefaultLabels({
      service: 'camille-api',
    });
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'app_process_',
    });
    this.instrumentPgConnect();
    this.instrumentPgQueries();
  }

  recordHttpRequest(
    method: string,
    route: string | undefined,
    statusCode: number,
    durationMs: number,
  ): void {
    const labels = {
      method: method.toUpperCase(),
      route: sanitizeRoute(route),
      status_code: String(statusCode),
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationMs / 1_000);
  }

  recordRedisConnectionError(component: string): void {
    this.redisConnectionErrorsTotal.inc({ component });
  }

  getRegistry(): Registry {
    return this.registry;
  }

  attachBullMqQueue(queue: Queue | null): void {
    if (!queue) {
      this.bullMqQueue = undefined;
      return;
    }

    this.bullMqQueue = queue;
  }

  attachDbPool(pool: InstrumentableDbPool | null): void {
    if (!pool) {
      this.dbPool = undefined;
      return;
    }

    this.dbPool = pool;

    if (pool[DB_POOL_INSTRUMENTED]) {
      return;
    }

    const acquireStartedAtByEventId = new Map<number, bigint>();

    pool.on('acquireRequest', (eventId: unknown) => {
      if (typeof eventId === 'number') {
        acquireStartedAtByEventId.set(eventId, process.hrtime.bigint());
      }
    });
    pool.on('acquireSuccess', (eventId: unknown) => {
      if (typeof eventId !== 'number') {
        return;
      }

      const startedAt = acquireStartedAtByEventId.get(eventId);
      acquireStartedAtByEventId.delete(eventId);

      if (startedAt) {
        this.recordDbPoolAcquire('ok', startedAt);
      }
    });
    pool.on('acquireFail', (eventId: unknown) => {
      if (typeof eventId !== 'number') {
        return;
      }

      const startedAt = acquireStartedAtByEventId.get(eventId);
      acquireStartedAtByEventId.delete(eventId);

      if (startedAt) {
        this.recordDbPoolAcquire('error', startedAt);
      }
    });

    pool[DB_POOL_INSTRUMENTED] = true;
  }

  async renderMetrics(): Promise<string> {
    this.refreshDbPoolMetrics();
    await this.refreshBullMqMetrics();

    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }

  private instrumentPgQueries(): void {
    const instrumentedClient = Client as typeof Client & {
      [PG_INSTRUMENTED]?: boolean;
    };

    if (instrumentedClient[PG_INSTRUMENTED]) {
      return;
    }

    const clientPrototype = Client.prototype as unknown as {
      query: (...args: unknown[]) => unknown;
    };
    const originalQuery = clientPrototype.query;
    const recordDbQuery = this.recordDbQuery.bind(this);

    clientPrototype.query = function instrumentedQuery(...args: unknown[]) {
      const operation = extractSqlOperation(args[0]);
      const statement = extractSqlText(args[0]);
      const startedAt = process.hrtime.bigint();
      const callbackIndex = typeof args[args.length - 1] === 'function'
        ? args.length - 1
        : -1;

      if (callbackIndex >= 0) {
        const originalCallback = args[callbackIndex] as (
          error: Error | null,
          result: unknown,
        ) => void;

        args[callbackIndex] = (error: Error | null, result: unknown) => {
          recordDbQuery(
            operation,
            statement,
            startedAt,
            error ? 'error' : 'ok',
          );

          originalCallback(error, result);
        };

        return originalQuery.apply(this, args);
      }

      const result = originalQuery.apply(this, args);

      if (result && typeof (result as Promise<unknown>).then === 'function') {
        return (result as Promise<unknown>)
          .then((value) => {
            recordDbQuery(operation, statement, startedAt, 'ok');

            return value;
          })
          .catch((error: unknown) => {
            recordDbQuery(operation, statement, startedAt, 'error');
            throw error;
          });
      }

      recordDbQuery(operation, statement, startedAt, 'ok');

      return result;
    };

    instrumentedClient[PG_INSTRUMENTED] = true;
  }

  private instrumentPgConnect(): void {
    const instrumentedClient = Client as typeof Client & {
      [PG_CONNECT_INSTRUMENTED]?: boolean;
    };

    if (instrumentedClient[PG_CONNECT_INSTRUMENTED]) {
      return;
    }

    const clientPrototype = Client.prototype as unknown as {
      connect: (...args: unknown[]) => unknown;
    };
    const originalConnect = clientPrototype.connect;
    const recordDbPoolConnect = this.recordDbPoolConnect.bind(this);

    clientPrototype.connect = function instrumentedConnect(...args: unknown[]) {
      const startedAt = process.hrtime.bigint();
      const callbackIndex = typeof args[0] === 'function' ? 0 : -1;

      if (callbackIndex >= 0) {
        const originalCallback = args[callbackIndex] as (error?: Error | null) => void;

        args[callbackIndex] = (error?: Error | null) => {
          recordDbPoolConnect(startedAt, error ? 'error' : 'ok');
          originalCallback(error);
        };

        return originalConnect.apply(this, args);
      }

      const result = originalConnect.apply(this, args);

      if (result && typeof (result as Promise<unknown>).then === 'function') {
        return (result as Promise<unknown>)
          .then((value) => {
            recordDbPoolConnect(startedAt, 'ok');

            return value;
          })
          .catch((error: unknown) => {
            recordDbPoolConnect(startedAt, 'error');
            throw error;
          });
      }

      recordDbPoolConnect(startedAt, 'ok');

      return result;
    };

    instrumentedClient[PG_CONNECT_INSTRUMENTED] = true;
  }

  private recordDbQuery(
    operation: string,
    statement: string | undefined,
    startedAt: bigint,
    status: 'ok' | 'error',
  ): void {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const durationMs = durationSeconds * 1_000;
    const labels = {
      operation,
      status,
    };

    this.dbQueriesTotal.inc(labels);
    this.dbQueryDurationSeconds.observe(labels, durationSeconds);
    this.logDbQuery(operation, statement, status, durationMs);
  }

  private recordDbPoolAcquire(
    status: DbPoolOperationStatus,
    startedAt: bigint,
  ): void {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

    this.dbPoolAcquireTotal.inc({ status });
    this.dbPoolAcquireDurationSeconds.observe({ status }, durationSeconds);
  }

  private recordDbPoolConnect(
    startedAt: bigint,
    status: DbPoolOperationStatus,
  ): void {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

    this.dbPoolConnectTotal.inc({ status });
    this.dbPoolConnectDurationSeconds.observe({ status }, durationSeconds);
  }

  private refreshDbPoolMetrics(): void {
    if (!this.dbPool) {
      return;
    }

    const poolCounts: Record<DbPoolStatus, number> = {
      active: this.dbPool.numUsed(),
      idle: this.dbPool.numFree(),
      waiting: this.dbPool.numPendingAcquires(),
      pending_create: this.dbPool.numPendingCreates(),
    };

    for (const [state, count] of Object.entries(poolCounts)) {
      this.dbPoolClients.set({ state }, count);
    }
  }

  private logDbQuery(
    operation: string,
    statement: string | undefined,
    status: 'ok' | 'error',
    durationMs: number,
  ): void {
    const isSlowQuery = durationMs >= this.slowQueryThresholdMs;

    if (!this.logQueries && !isSlowQuery) {
      return;
    }

    const requestContext = this.requestContextService.get();
    const traceContext = getActiveTraceContext();
    const event = isSlowQuery ? 'db.query.slow' : 'db.query.executed';
    const logMethod = status === 'error'
      ? this.logger.warn.bind(this.logger)
      : isSlowQuery
        ? this.logger.warn.bind(this.logger)
        : this.logger.debug.bind(this.logger);

    logMethod(
      {
        actorId: requestContext.actorId,
        actorEmail: requestContext.actorEmail,
        context: ObservabilityService.name,
        db: {
          durationMs: Number(durationMs.toFixed(3)),
          operation,
          slowQueryThresholdMs: this.slowQueryThresholdMs,
          statement,
          status,
        },
        event,
        requestId: requestContext.requestId,
        sessionId: requestContext.sessionId,
        spanId: traceContext?.spanId,
        traceId: traceContext?.traceId,
      },
      `${operation} query ${status} in ${Math.round(durationMs)}ms`,
    );
  }

  private async refreshBullMqMetrics(): Promise<void> {
    if (!this.bullMqQueue) {
      return;
    }

    const counts = await this.bullMqQueue.getJobCounts(
      'active',
      'completed',
      'delayed',
      'failed',
      'paused',
      'prioritized',
      'waiting',
      'waiting-children',
    );

    for (const [state, count] of Object.entries(counts)) {
      this.bullMqJobCount.set(
        {
          queue: this.bullMqQueue.name,
          state,
        },
        count,
      );
    }
  }
}


// ---------- Private helpers ----------

function sanitizeRoute(route?: string): string {
  if (!route || route.trim().length === 0) {
    return 'unknown';
  }

  return route.replace(/\/+/g, '/');
}

function extractSqlOperation(statement: unknown): string {
  if (typeof statement === 'string') {
    const match = statement.trim().match(/^([a-z]+)/i);

    return match?.[1]?.toUpperCase() ?? 'UNKNOWN';
  }

  if (
    typeof statement === 'object'
    && statement !== null
    && 'text' in statement
    && typeof statement.text === 'string'
  ) {
    return extractSqlOperation(statement.text);
  }

  return 'UNKNOWN';
}

function extractSqlText(statement: unknown): string | undefined {
  if (typeof statement === 'string') {
    return normalizeSql(statement);
  }

  if (
    typeof statement === 'object'
    && statement !== null
    && 'text' in statement
    && typeof statement.text === 'string'
  ) {
    return normalizeSql(statement.text);
  }

  return undefined;
}

function normalizeSql(statement: string): string {
  return statement.replace(/\s+/g, ' ').trim();
}