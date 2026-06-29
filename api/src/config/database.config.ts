import type { Options } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';

type DatabaseEnv = Partial<
  Record<
    'DB_HOST' | 'DB_PORT' | 'DB_USER' | 'DB_PASSWORD' | 'DB_NAME' | 'NODE_ENV',
    string
  >
>;

export function buildDatabaseConfig(
  env: DatabaseEnv,
  options?: { includeEntityGlobs?: boolean; debug?: boolean },
): Options<PostgreSqlDriver> {
  const includeEntityGlobs = options?.includeEntityGlobs ?? false;
  const debug = options?.debug ?? env.NODE_ENV !== 'production';

  return {
    driver: PostgreSqlDriver,
    host: env.DB_HOST ?? '127.0.0.1',
    port: Number(env.DB_PORT ?? 5432),
    user: env.DB_USER ?? 'postgres',
    password: env.DB_PASSWORD ?? 'postgres',
    dbName: env.DB_NAME ?? 'app',
    debug,
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
