import type { PinoLogger } from 'nestjs-pino';
import type { RequestContextService } from '../request-context/request-context.service';
import { ObservabilityService } from './observability.service';

type PoolEventName = 'acquireRequest' | 'acquireSuccess' | 'acquireFail';
type PoolEventHandler = (...args: unknown[]) => void;

class FakeDbPool {
  active = 0;
  idle = 0;
  waiting = 0;
  pendingCreates = 0;

  private readonly handlers = new Map<PoolEventName, PoolEventHandler[]>();

  numUsed(): number {
    return this.active;
  }

  numFree(): number {
    return this.idle;
  }

  numPendingAcquires(): number {
    return this.waiting;
  }

  numPendingCreates(): number {
    return this.pendingCreates;
  }

  on(eventName: PoolEventName, handler: PoolEventHandler): void {
    const handlers = this.handlers.get(eventName) ?? [];

    handlers.push(handler);
    this.handlers.set(eventName, handlers);
  }

  emit(eventName: PoolEventName, ...args: unknown[]): void {
    for (const handler of this.handlers.get(eventName) ?? []) {
      handler(...args);
    }
  }
}

describe('ObservabilityService', () => {
  function createService(): ObservabilityService {
    const logger = {
      debug: jest.fn(),
      warn: jest.fn(),
    } as unknown as PinoLogger;
    const requestContextService = {
      get: jest.fn().mockReturnValue({}),
    } as unknown as RequestContextService;

    return new ObservabilityService(logger, requestContextService);
  }

  it('exports database pool state gauges', async () => {
    const service = createService();
    const pool = new FakeDbPool();

    pool.active = 3;
    pool.idle = 2;
    pool.waiting = 1;
    pool.pendingCreates = 4;

    service.attachDbPool(pool);

    const metrics = await service.renderMetrics();

    expect(metrics).toContain('app_db_pool_clients{state="active",service="camille-api"} 3');
    expect(metrics).toContain('app_db_pool_clients{state="idle",service="camille-api"} 2');
    expect(metrics).toContain('app_db_pool_clients{state="waiting",service="camille-api"} 1');
    expect(metrics).toContain('app_db_pool_clients{state="pending_create",service="camille-api"} 4');
  });

  it('records database pool acquire duration by status', async () => {
    const service = createService();
    const pool = new FakeDbPool();

    service.attachDbPool(pool);
    pool.emit('acquireRequest', 1);
    pool.emit('acquireSuccess', 1);
    pool.emit('acquireRequest', 2);
    pool.emit('acquireFail', 2, new Error('timeout'));

    const metrics = await service.renderMetrics();

    expect(metrics).toContain('app_db_pool_acquire_total{status="ok",service="camille-api"} 1');
    expect(metrics).toContain('app_db_pool_acquire_total{status="error",service="camille-api"} 1');
    expect(metrics).toContain('app_db_pool_acquire_duration_seconds_count{service="camille-api",status="ok"} 1');
    expect(metrics).toContain('app_db_pool_acquire_duration_seconds_count{service="camille-api",status="error"} 1');
  });
});
