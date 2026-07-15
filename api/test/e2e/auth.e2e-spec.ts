import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import {
  ClassSerializerInterceptor,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRequire } from 'node:module';
import { Logger, PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types';
import { setupApiDocs } from '../../src/common/docs/setup-api-docs';
import { setupBullBoard } from '../../src/common/docs/setup-bull-board';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { RequestLoggingInterceptor } from '../../src/common/interceptors/request-logging.interceptor';
import { parseCorsAllowedOrigins } from '../../src/config/cors.config';
import { ObservabilityService } from '../../src/modules/shared/observability/observability.service';
import { BULLMQ_QUEUE } from '../../src/modules/shared/queue/infra/queue.constants';
import { RequestContextService } from '../../src/modules/shared/request-context/request-context.service';
import { createTestDatabase, dropTestDatabase } from '../support/test-postgres';

jest.setTimeout(30_000);

const expectedMemberPermissions: string[] = [];
const API_PREFIX = 'v1';
const requireModule = createRequire(__filename);

type AuthHttpResponse = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    display_name?: string;
    session_id: string;
    roles: string[];
    permissions: string[];
  };
};

type MeHttpResponse = {
  id: string;
  email: string;
  display_name?: string;
  session_id: string;
  roles: string[];
  permissions: string[];
};

describe('Auth flow (e2e)', () => {
  let app: INestApplication<App>;
  let originalEnv: NodeJS.ProcessEnv;
  let testDb: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => {
    originalEnv = { ...process.env };
    testDb = await createTestDatabase();

    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = testDb.rootConfig.host;
    process.env.DB_PORT = String(testDb.rootConfig.port);
    process.env.DB_USER = testDb.rootConfig.user;
    process.env.DB_PASSWORD = testDb.rootConfig.password;
    process.env.DB_NAME = testDb.dbName;
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_TTL = '15m';
    process.env.JWT_REFRESH_TTL = '7d';
    process.env.BCRYPT_SALT_ROUNDS = '4';
    process.env.CACHE_DRIVER = 'memory';
    process.env.RATE_LIMIT_DRIVER = 'memory';
    process.env.QUEUE_DRIVER = 'inline';
    process.env.STORAGE_DRIVER = 'local';
    const { AppModule } = requireModule('../../src/modules/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    await app.resolve(PinoLogger);
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    const corsAllowedOrigins = parseCorsAllowedOrigins(process.env);

    if (corsAllowedOrigins.length > 0) {
      app.enableCors({
        origin: corsAllowedOrigins,
        credentials: true,
      });
    }

    app.enableShutdownHooks();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(
      new GlobalExceptionFilter(
        app.get(RequestContextService),
        await app.resolve(PinoLogger),
      ),
    );
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
      new RequestLoggingInterceptor(
        app.get(RequestContextService),
        app.get(ObservabilityService),
        await app.resolve(PinoLogger),
      ),
    );
    app.setGlobalPrefix(API_PREFIX, {
      exclude: [
        {
          path: 'health',
          method: RequestMethod.GET,
        },
        {
          path: 'health/ready',
          method: RequestMethod.GET,
        },
        {
          path: 'metrics',
          method: RequestMethod.GET,
        },
      ],
    });
    setupApiDocs(app);
    setupBullBoard(
      app,
      app.get(BULLMQ_QUEUE, { strict: false }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    restoreProcessEnv(originalEnv);

    if (testDb) {
      await dropTestDatabase(testDb);
    }
  });

  it('registers, authenticates, refreshes, and revokes a session', async () => {
    const email = `member-${Date.now()}@example.com`;

    const registerResponse = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        password: 'password123',
        display_name: 'Member User',
      })
      .expect(201);
    const registerBody = registerResponse.body as AuthHttpResponse;

    expect(registerBody.access_token).toEqual(expect.any(String));
    expect(registerBody.refresh_token).toEqual(expect.any(String));
    expect(registerBody.user).toMatchObject({
      email,
      display_name: 'Member User',
      roles: ['member'],
      permissions: expectedMemberPermissions,
    });
    expect(registerResponse.headers['cache-control']).toBe('no-store');
    expect(String(registerResponse.headers['set-cookie'] ?? '')).toContain('accessToken=');
    expect(String(registerResponse.headers['set-cookie'] ?? '')).toContain('refreshToken=');
    expect(registerBody.user.id).toEqual(expect.any(String));
    expect(registerBody.user.session_id).toEqual(expect.any(String));

    const accessToken = registerBody.access_token;
    const refreshToken = registerBody.refresh_token;
    const sessionId = registerBody.user.session_id;

    const meResponse = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const meBody = meResponse.body as MeHttpResponse;

    expect(meBody).toMatchObject({
      email,
      display_name: 'Member User',
      session_id: sessionId,
      roles: ['member'],
      permissions: expectedMemberPermissions,
    });
    expect(meResponse.headers['cache-control']).toBe('no-store');

    const loginResponse = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email,
        password: 'password123',
      })
      .expect(200);
    const loginBody = loginResponse.body as AuthHttpResponse;

    expect(loginResponse.headers['cache-control']).toBe('no-store');
    expect(String(loginResponse.headers['set-cookie'] ?? '')).toContain('accessToken=');
    expect(String(loginResponse.headers['set-cookie'] ?? '')).toContain('refreshToken=');
    expect(loginBody.user.email).toBe(email);
    expect(loginBody.user.session_id).not.toBe(sessionId);

    const refreshResponse = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(200);
    const refreshBody = refreshResponse.body as AuthHttpResponse;

    expect(refreshResponse.headers['cache-control']).toBe('no-store');
    expect(String(refreshResponse.headers['set-cookie'] ?? '')).toContain('accessToken=');
    expect(String(refreshResponse.headers['set-cookie'] ?? '')).toContain('refreshToken=');
    expect(refreshBody.access_token).toEqual(expect.any(String));
    expect(refreshBody.refresh_token).toEqual(expect.any(String));
    expect(refreshBody.user.email).toBe(email);
    expect(refreshBody.user.session_id).toBe(sessionId);
    expect(refreshBody.refresh_token).not.toBe(refreshToken);

    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(401);

    const logoutResponse = await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${refreshBody.access_token}`)
      .expect(204);

    expect(logoutResponse.headers['cache-control']).toBe('no-store');

    await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${refreshBody.access_token}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshBody.refresh_token })
      .expect(401);
  });

  it('exposes a health endpoint without a global API prefix', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    const responseBody = response.body as unknown as {
      status: string;
      timestamp: string;
    };

    expect(responseBody.status).toBe('ok');
    expect(responseBody.timestamp).toEqual(expect.any(String));
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('applies stricter route-specific rate limits for register, login, and refresh', async () => {
    const registerIp = '203.0.113.10';
    const registerEmailPrefix = `rate-limit-register-${Date.now()}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .set('X-Forwarded-For', registerIp)
        .send({
          email: `${registerEmailPrefix}-${attempt}@example.com`,
          password: 'password123',
          display_name: `Register Attempt ${attempt + 1}`,
        })
        .expect(201);
    }

    const blockedRegisterResponse = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .set('X-Forwarded-For', registerIp)
      .send({
        email: `${registerEmailPrefix}-blocked@example.com`,
        password: 'password123',
        display_name: 'Blocked Register Attempt',
      })
      .expect(429);

    expect(blockedRegisterResponse.body).toMatchObject({
      statusCode: 429,
      error: 'ThrottlerException',
      message: 'Too many requests.',
    });

    const loginIp = '203.0.113.11';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('X-Forwarded-For', loginIp)
        .send({
          email: 'missing-user@example.com',
          password: 'password123',
        })
        .expect(401);
    }

    const blockedLoginResponse = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('X-Forwarded-For', loginIp)
      .send({
        email: 'missing-user@example.com',
        password: 'password123',
      })
      .expect(429);

    expect(blockedLoginResponse.body).toMatchObject({
      statusCode: 429,
      error: 'ThrottlerException',
      message: 'Too many requests.',
    });

    const refreshIp = '203.0.113.12';

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('X-Forwarded-For', refreshIp)
        .send({
          refresh_token: 'invalid-refresh-token-value-1234567890',
        })
        .expect(401);
    }

    const blockedRefreshResponse = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('X-Forwarded-For', refreshIp)
      .send({
        refresh_token: 'invalid-refresh-token-value-1234567890',
      })
      .expect(429);

    expect(blockedRefreshResponse.body).toMatchObject({
      statusCode: 429,
      error: 'ThrottlerException',
      message: 'Too many requests.',
    });
  });
});

function restoreProcessEnv(originalEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}
