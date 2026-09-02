import { z } from 'zod';

type AppEnv = NodeJS.ProcessEnv;

const optionalTrimmedString = () =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().trim().min(1).optional(),
  );

const optionalUrlString = () =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.url().optional(),
  );

const positiveIntegerString = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Expected a positive integer value.')
  .refine((value) => Number(value) > 0, 'Expected a positive integer value.');

const nonNegativeIntegerString = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Expected a non-negative integer value.');

const DEFAULT_DB_POOL_MAX = 10;
const DEFAULT_PRODUCTION_DB_POOL_MIN = 2;
const DEFAULT_NON_PRODUCTION_DB_POOL_MIN = 0;

const appEnvBaseSchema = z.object({
  PORT: positiveIntegerString.default('3000'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  REQUEST_BODY_LIMIT: z.string().trim().min(1).default('5mb'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0
        || value.split(',').every((segment) => segment.trim().length > 0),
      'Expected a comma-separated list without empty entries.',
    )
    .optional(),
  DATABASE_URL: optionalUrlString(),
  DB_HOST: optionalTrimmedString(),
  DB_PORT: positiveIntegerString.default('5432'),
  DB_USER: optionalTrimmedString(),
  DB_PASSWORD: optionalTrimmedString(),
  DB_NAME: optionalTrimmedString(),
  DB_POOL_MIN: nonNegativeIntegerString.optional(),
  DB_POOL_MAX: positiveIntegerString.optional(),
  DB_POOL_IDLE_TIMEOUT_MS: positiveIntegerString.optional(),
  DB_POOL_CONNECTION_TIMEOUT_MS: positiveIntegerString.optional(),
  REDIS_URL: z.url().default('redis://127.0.0.1:6379'),
  CACHE_DRIVER: z.enum(['memory', 'redis']).optional(),
  CACHE_TTL: z.string().trim().min(1).default('60s'),
  QUEUE_DRIVER: z.enum(['inline', 'redis']).optional(),
  QUEUE_NAME: z.string().trim().min(1).default('default'),
  QUEUE_PREFIX: z.string().trim().min(1).default('nest-template'),
  QUEUE_REDIS_URL: z.url().optional(),
  QUEUE_JOB_ATTEMPTS: positiveIntegerString.default('5'),
  QUEUE_JOB_BACKOFF: z.string().trim().min(1).default('5s'),
  QUEUE_REMOVE_COMPLETED_AFTER: z.string().trim().min(1).default('1d'),
  QUEUE_REMOVE_FAILED_AFTER: z.string().trim().min(1).default('7d'),
  QUEUE_WORKER_CONCURRENCY: positiveIntegerString.default('10'),
  JWT_ACCESS_SECRET: z.string().trim().min(1),
  JWT_REFRESH_SECRET: z.string().trim().min(1),
  JWT_ACCESS_TTL: z.string().trim().min(1),
  JWT_REFRESH_TTL: z.string().trim().min(1),
  BCRYPT_SALT_ROUNDS: positiveIntegerString.default('12'),
  RATE_LIMIT_DRIVER: z.enum(['memory', 'redis']).optional(),
  RATE_LIMIT_LIMIT: positiveIntegerString.default('20'),
  RATE_LIMIT_TTL: z.string().trim().min(1).default('60s'),
  RATE_LIMIT_BLOCK_DURATION: z.string().trim().min(1).optional(),
  MAIL_DRIVER: z.enum(['logger', 'resend']).default('logger'),
  MAIL_DEFAULT_FROM_EMAIL: z.email().default('noreply@example.com'),
  MAIL_DEFAULT_FROM_NAME: z.string().trim().min(1).default('Nest Template'),
  RESEND_API_KEY: optionalTrimmedString(),
  APP_BASE_URL: optionalUrlString(),
  API_BASE_URL: optionalUrlString(),
  GOOGLE_OAUTH_CLIENT_ID: optionalTrimmedString(),
  GOOGLE_OAUTH_CLIENT_SECRET: optionalTrimmedString(),
  GITHUB_OAUTH_CLIENT_ID: optionalTrimmedString(),
  GITHUB_OAUTH_CLIENT_SECRET: optionalTrimmedString(),
  AI_PROVIDER: z.enum(['openai', 'gemini', 'groq', 'openrouter', 'router', 'fake', 'noop']).optional(),
  AI_DEFAULT_TEXT_MODEL: z.string().trim().min(1).default('openai:gpt-5.6'),
  AI_DEFAULT_REASONING_EFFORT: z.enum(['minimal', 'low', 'medium', 'high']).default('low'),
  AI_DEFAULT_MAX_TOKENS: positiveIntegerString.default('1200'),
  AI_MODELS: optionalTrimmedString(),
  AI_DEFAULT_EMBEDDING_MODEL: z.string().trim().min(1).default('openai:text-embedding-3-small'),
  AI_EMBEDDING_MODELS: optionalTrimmedString(),
  AI_ROUTER_TEXT_PROVIDERS: optionalTrimmedString(),
  AI_ROUTER_EMBEDDING_PROVIDER: z.enum(['openai']).optional(),
  OPENAI_API_KEY: optionalTrimmedString(),
  OPENAI_BASE_URL: optionalUrlString(),
  GEMINI_API_KEY: optionalTrimmedString(),
  GEMINI_BASE_URL: optionalUrlString(),
  GEMINI_DEFAULT_TEXT_MODEL: z.string().trim().min(1).optional(),
  GROQ_API_KEY: optionalTrimmedString(),
  GROQ_BASE_URL: optionalUrlString(),
  GROQ_DEFAULT_TEXT_MODEL: z.string().trim().min(1).optional(),
  OPENROUTER_API_KEY: optionalTrimmedString(),
  OPENROUTER_BASE_URL: optionalUrlString(),
  OPENROUTER_DEFAULT_TEXT_MODEL: z.string().trim().min(1).optional(),
  PAYMENT_DRIVER: z.enum(['noop', 'stripe']).default('noop'),
  PAYMENT_PUBLIC_BASE_URL: optionalUrlString(),
  PAYMENT_WEBHOOK_SECRET: optionalTrimmedString(),
  PAYMENT_SUCCESS_PATH: z.string().trim().min(1).default('/payments/success'),
  PAYMENT_CANCEL_PATH: z.string().trim().min(1).default('/payments/cancel'),
  STRIPE_SECRET_KEY: optionalTrimmedString(),
  STRIPE_WEBHOOK_SECRET: optionalTrimmedString(),
  STRIPE_PLUS_PRICE_ID: optionalTrimmedString(),
  METRICS_BEARER_TOKEN: optionalTrimmedString(),
  OTEL_ENABLED: z.enum(['true', 'false']).default('true'),
  OTEL_SERVICE_NAME: z.string().trim().min(1).default('camille-api'),
  OTEL_TRACES_CONSOLE_EXPORTER: z.enum(['true', 'false']).default('false'),
  OTEL_LOGS_EXPORTER: optionalTrimmedString(),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrlString(),
  OTEL_EXPORTER_OTLP_HEADERS: optionalTrimmedString(),
  OTEL_EXPORTER_OTLP_PROTOCOL: z
    .enum(['grpc', 'http/protobuf', 'http/json'])
    .optional(),
  STORAGE_DRIVER: z.enum(['local', 'minio']).default('local'),
  STORAGE_LOCAL_ROOT: z.string().trim().min(1).default('./storage'),
  STORAGE_PUBLIC_BASE_URL: optionalUrlString(),
  STORAGE_OBJECT_STORAGE_ENDPOINT: optionalUrlString(),
  STORAGE_OBJECT_STORAGE_REGION: optionalTrimmedString(),
  STORAGE_OBJECT_STORAGE_BUCKET: optionalTrimmedString(),
  STORAGE_OBJECT_STORAGE_ACCESS_KEY: optionalTrimmedString(),
  STORAGE_OBJECT_STORAGE_SECRET_KEY: optionalTrimmedString(),
  STORAGE_OBJECT_STORAGE_FORCE_PATH_STYLE: z.enum(['true', 'false']).optional(),
  STORAGE_MINIO_ENDPOINT: optionalUrlString(),
  STORAGE_MINIO_REGION: z.string().trim().min(1).default('us-east-1'),
  STORAGE_MINIO_BUCKET: optionalTrimmedString(),
  STORAGE_MINIO_ACCESS_KEY: optionalTrimmedString(),
  STORAGE_MINIO_SECRET_KEY: optionalTrimmedString(),
  STORAGE_MINIO_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('true'),
});

const appEnvSchema = appEnvBaseSchema.superRefine((env, context) => {
  if (!env.DATABASE_URL) {
    const requiredDatabaseFields = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const;

    for (const field of requiredDatabaseFields) {
      if (!env[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `Expected ${field} when DATABASE_URL is not set.`,
        });
      }
    }
  }

  const dbPoolMin = Number(
    env.DB_POOL_MIN ??
      (env.NODE_ENV === 'production'
        ? DEFAULT_PRODUCTION_DB_POOL_MIN
        : DEFAULT_NON_PRODUCTION_DB_POOL_MIN),
  );
  const dbPoolMax = Number(env.DB_POOL_MAX ?? DEFAULT_DB_POOL_MAX);

  if (dbPoolMin > dbPoolMax) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DB_POOL_MIN'],
      message: 'Expected DB_POOL_MIN to be less than or equal to DB_POOL_MAX.',
    });
  }

  if (env.MAIL_DRIVER === 'resend' && !env.RESEND_API_KEY) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RESEND_API_KEY'],
      message: 'Expected RESEND_API_KEY when MAIL_DRIVER is resend.',
    });
  }

  if (
    env.MAIL_DRIVER === 'resend'
    && env.MAIL_DEFAULT_FROM_EMAIL.toLowerCase().endsWith('@example.com')
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['MAIL_DEFAULT_FROM_EMAIL'],
      message:
        'Expected MAIL_DEFAULT_FROM_EMAIL to use a verified sender domain when MAIL_DRIVER is resend.',
    });
  }

  if (env.PAYMENT_DRIVER === 'stripe') {
    const requiredPaymentFields = [
      'PAYMENT_PUBLIC_BASE_URL',
      'STRIPE_SECRET_KEY',
      'STRIPE_PLUS_PRICE_ID',
    ] as const;

    for (const field of requiredPaymentFields) {
      if (!env[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `Expected ${field} when PAYMENT_DRIVER is stripe.`,
        });
      }
    }

    if (!env.STRIPE_WEBHOOK_SECRET && !env.PAYMENT_WEBHOOK_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_WEBHOOK_SECRET'],
        message:
          'Expected STRIPE_WEBHOOK_SECRET or PAYMENT_WEBHOOK_SECRET when PAYMENT_DRIVER is stripe.',
      });
    }
  }

  if (env.STORAGE_DRIVER === 'minio') {
    const requiredFields = [
      ['STORAGE_OBJECT_STORAGE_ENDPOINT', 'STORAGE_MINIO_ENDPOINT'],
      ['STORAGE_OBJECT_STORAGE_BUCKET', 'STORAGE_MINIO_BUCKET'],
      ['STORAGE_OBJECT_STORAGE_ACCESS_KEY', 'STORAGE_MINIO_ACCESS_KEY'],
      ['STORAGE_OBJECT_STORAGE_SECRET_KEY', 'STORAGE_MINIO_SECRET_KEY'],
    ] as const;

    for (const [preferredField, legacyField] of requiredFields) {
      if (!env[preferredField] && !env[legacyField]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [preferredField],
          message: `Expected ${preferredField} when STORAGE_DRIVER is minio.`,
        });
      }
    }
  }
});

export function validateAppEnv(env: AppEnv): AppEnv {
  const parsedEnv = appEnvSchema.safeParse(env);

  if (!parsedEnv.success) {
    const issues = parsedEnv.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return {
    ...env,
    ...parsedEnv.data,
  };
}
