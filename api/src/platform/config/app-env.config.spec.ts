import { validateAppEnv } from './app-env.config';

describe('validateAppEnv', () => {
  const validEnv = {
    DATABASE_URL: 'postgres://user:password@example.com:5432/app',
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
  };

  it('accepts PostgreSQL pool tuning environment variables', () => {
    const env = validateAppEnv({
      ...validEnv,
      DB_POOL_MIN: '2',
      DB_POOL_MAX: '10',
      DB_POOL_IDLE_TIMEOUT_MS: '60000',
      DB_POOL_CONNECTION_TIMEOUT_MS: '5000',
    });

    expect(env.DB_POOL_MIN).toBe('2');
    expect(env.DB_POOL_MAX).toBe('10');
    expect(env.DB_POOL_IDLE_TIMEOUT_MS).toBe('60000');
    expect(env.DB_POOL_CONNECTION_TIMEOUT_MS).toBe('5000');
  });

  it('rejects a PostgreSQL pool minimum larger than the maximum', () => {
    expect(() =>
      validateAppEnv({
        ...validEnv,
        DB_POOL_MIN: '11',
        DB_POOL_MAX: '10',
      }),
    ).toThrow('Expected DB_POOL_MIN to be less than or equal to DB_POOL_MAX.');
  });

  it('rejects a production PostgreSQL pool maximum smaller than the default minimum', () => {
    expect(() =>
      validateAppEnv({
        ...validEnv,
        DB_POOL_MAX: '1',
        NODE_ENV: 'production',
      }),
    ).toThrow('Expected DB_POOL_MIN to be less than or equal to DB_POOL_MAX.');
  });
});
