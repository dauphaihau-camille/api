import type { Options } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

const DEFAULT_DB_POOL_MAX = 10;
const DEFAULT_DB_POOL_IDLE_TIMEOUT_MS = 60_000;
const DEFAULT_DB_POOL_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_PRODUCTION_DB_POOL_MIN = 2;
const DEFAULT_NON_PRODUCTION_DB_POOL_MIN = 0;

type DatabaseEnv = Partial<
  Record<
    | 'DATABASE_URL'
    | 'DB_HOST'
    | 'DB_PORT'
    | 'DB_USER'
    | 'DB_PASSWORD'
    | 'DB_NAME'
    | 'DB_POOL_MIN'
    | 'DB_POOL_MAX'
    | 'DB_POOL_IDLE_TIMEOUT_MS'
    | 'DB_POOL_CONNECTION_TIMEOUT_MS'
    | 'NODE_ENV',
    string
  >
>;

export function buildDatabaseConfig(
  env: DatabaseEnv,
  options?: { includeEntityGlobs?: boolean; debug?: boolean },
): Options<PostgreSqlDriver> {
  const includeEntityGlobs = options?.includeEntityGlobs ?? false;
  const debug = options?.debug ?? env.NODE_ENV !== 'production';
  const databaseUrl = env.DATABASE_URL;
  const databaseUrlParams = databaseUrl ? new URL(databaseUrl).searchParams : null;
  const sslMode = databaseUrlParams?.get('sslmode');
  const requiresSsl = sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full';
  const enableChannelBinding = databaseUrlParams?.get('channel_binding') === 'require';
  const poolMax = readInteger(env.DB_POOL_MAX, DEFAULT_DB_POOL_MAX);
  const poolMin = readInteger(
    env.DB_POOL_MIN,
    env.NODE_ENV === 'production'
      ? DEFAULT_PRODUCTION_DB_POOL_MIN
      : DEFAULT_NON_PRODUCTION_DB_POOL_MIN,
  );
  const poolIdleTimeoutMs = readInteger(
    env.DB_POOL_IDLE_TIMEOUT_MS,
    DEFAULT_DB_POOL_IDLE_TIMEOUT_MS,
  );
  const poolConnectionTimeoutMs = readInteger(
    env.DB_POOL_CONNECTION_TIMEOUT_MS,
    DEFAULT_DB_POOL_CONNECTION_TIMEOUT_MS,
  );

  if (poolMin > poolMax) {
    throw new Error('Expected DB_POOL_MIN to be less than or equal to DB_POOL_MAX.');
  }

  const connectionOptions = databaseUrl
    ? { clientUrl: databaseUrl }
    : {
      host: env.DB_HOST ?? '127.0.0.1',
      port: Number(env.DB_PORT ?? 5432),
      user: env.DB_USER ?? 'postgres',
      password: env.DB_PASSWORD ?? 'postgres',
      dbName: env.DB_NAME ?? 'app',
    };

  const driverOptions = {
    connection: {
      ...(requiresSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      ...(enableChannelBinding ? { enableChannelBinding: true } : {}),
      connectionTimeoutMillis: poolConnectionTimeoutMs,
    },
  };

  return {
    driver: PostgreSqlDriver,
    ...connectionOptions,
    pool: {
      min: poolMin,
      max: poolMax,
      idleTimeoutMillis: poolIdleTimeoutMs,
      acquireTimeoutMillis: poolConnectionTimeoutMs,
      createTimeoutMillis: poolConnectionTimeoutMs,
    },
    debug,
    driverOptions,
    ...(includeEntityGlobs
      ? {
        entities: ['dist/**/*.entity.js'],
        entitiesTs: ['src/**/*.entity.ts'],
      }
      : {}),
    migrations: {
      path: 'dist/database/migrations',
      pathTs: 'database/migrations',
      tableName: 'mikro_orm_migrations',
    },
  };
}

function readInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) ? parsedValue : fallback;
}
