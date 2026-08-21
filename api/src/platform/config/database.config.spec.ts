import { buildDatabaseConfig } from './database.config';

describe('buildDatabaseConfig', () => {
  it('uses a warm production PostgreSQL pool by default', () => {
    const config = buildDatabaseConfig({
      DATABASE_URL: 'postgres://user:password@example.com:5432/app',
      NODE_ENV: 'production',
    });

    expect(config.pool).toEqual({
      acquireTimeoutMillis: 5_000,
      createTimeoutMillis: 5_000,
      idleTimeoutMillis: 60_000,
      max: 10,
      min: 2,
    });
    expect(config.driverOptions).toEqual({
      connection: {
        connectionTimeoutMillis: 5_000,
      },
    });
  });

  it('does not keep idle PostgreSQL clients warm outside production by default', () => {
    const config = buildDatabaseConfig({
      DB_HOST: '127.0.0.1',
      DB_PORT: '5432',
      DB_USER: 'postgres',
      DB_PASSWORD: 'postgres',
      DB_NAME: 'app',
      NODE_ENV: 'development',
    });

    expect(config.pool).toEqual(expect.objectContaining({
      max: 10,
      min: 0,
    }));
  });

  it('maps PostgreSQL pool environment overrides into MikroORM options', () => {
    const config = buildDatabaseConfig({
      DATABASE_URL: 'postgres://user:password@example.com:5432/app?sslmode=require',
      DB_POOL_MIN: '3',
      DB_POOL_MAX: '8',
      DB_POOL_IDLE_TIMEOUT_MS: '45000',
      DB_POOL_CONNECTION_TIMEOUT_MS: '7000',
      NODE_ENV: 'production',
    });

    expect(config.pool).toEqual({
      acquireTimeoutMillis: 7_000,
      createTimeoutMillis: 7_000,
      idleTimeoutMillis: 45_000,
      max: 8,
      min: 3,
    });
    expect(config.driverOptions).toEqual({
      connection: {
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 7_000,
      },
    });
  });

  it('rejects an effective PostgreSQL pool minimum larger than the maximum', () => {
    expect(() =>
      buildDatabaseConfig({
        DATABASE_URL: 'postgres://user:password@example.com:5432/app',
        DB_POOL_MAX: '1',
        NODE_ENV: 'production',
      }),
    ).toThrow('Expected DB_POOL_MIN to be less than or equal to DB_POOL_MAX.');
  });
});
