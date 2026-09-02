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

  it('defaults the request body limit for document command payloads', () => {
    const env = validateAppEnv(validEnv);

    expect(env.REQUEST_BODY_LIMIT).toBe('5mb');
  });

  it('accepts an explicit request body limit', () => {
    const env = validateAppEnv({
      ...validEnv,
      REQUEST_BODY_LIMIT: '10mb',
    });

    expect(env.REQUEST_BODY_LIMIT).toBe('10mb');
  });

  it('accepts AI router provider environment variables', () => {
    const env = validateAppEnv({
      ...validEnv,
      AI_PROVIDER: 'router',
      AI_ROUTER_TEXT_PROVIDERS: 'gemini,groq,openrouter',
      AI_ROUTER_EMBEDDING_PROVIDER: 'openai',
      GEMINI_API_KEY: 'gemini-key',
      GEMINI_DEFAULT_TEXT_MODEL: 'gemini-2.5-flash',
      GROQ_API_KEY: 'groq-key',
      GROQ_DEFAULT_TEXT_MODEL: 'openai/gpt-oss-20b',
      OPENROUTER_API_KEY: 'openrouter-key',
      OPENROUTER_DEFAULT_TEXT_MODEL: 'openai/gpt-oss-20b',
    });

    expect(env.AI_PROVIDER).toBe('router');
    expect(env.AI_ROUTER_TEXT_PROVIDERS).toBe('gemini,groq,openrouter');
    expect(env.AI_ROUTER_EMBEDDING_PROVIDER).toBe('openai');
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
