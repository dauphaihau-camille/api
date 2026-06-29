import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import {
  ClassSerializerInterceptor,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Logger, PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types';
import { setupApiDocs } from '../../src/common/docs/setup-api-docs';
import { setupBullBoard } from '../../src/common/docs/setup-bull-board';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { RequestLoggingInterceptor } from '../../src/common/interceptors/request-logging.interceptor';
import { parseCorsAllowedOrigins } from '../../src/config/cors.config';
import { AppModule } from '../../src/modules/app.module';
import { ObservabilityService } from '../../src/modules/shared/observability/observability.service';
import { BULLMQ_QUEUE } from '../../src/modules/shared/queue/infra/queue.constants';
import { RequestContextService } from '../../src/modules/shared/request-context/request-context.service';
import type {
  AuthResponse,
  UserProfile,
} from '../../src/modules/domains/auth/app/auth.types';
import { createTestDatabase, dropTestDatabase } from '../support/test-postgres';

jest.setTimeout(30_000);

const expectedMemberPermissions = ['auth.me.read', 'auth.session.manage'];
const API_PREFIX = 'v1';

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
        displayName: 'Member User',
      })
      .expect(201);
    const registerBody = registerResponse.body as unknown as AuthResponse;

    expect(registerBody.accessToken).toEqual(expect.any(String));
    expect(registerBody.refreshToken).toEqual(expect.any(String));
    expect(registerBody.user).toMatchObject({
      email,
      displayName: 'Member User',
      roles: ['member'],
      permissions: expectedMemberPermissions,
    });
    expect(registerResponse.headers['cache-control']).toBe('no-store');
    expect(String(registerResponse.headers['set-cookie'] ?? '')).toContain('accessToken=');
    expect(String(registerResponse.headers['set-cookie'] ?? '')).toContain('refreshToken=');
    expect(registerBody.user.id).toEqual(expect.any(String));
    expect(registerBody.user.sessionId).toEqual(expect.any(String));

    const accessToken = registerBody.accessToken;
    const refreshToken = registerBody.refreshToken;
    const sessionId = registerBody.user.sessionId;

    const meResponse = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const meBody = meResponse.body as unknown as UserProfile;

    expect(meBody).toMatchObject({
      email,
      displayName: 'Member User',
      sessionId,
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
    const loginBody = loginResponse.body as unknown as AuthResponse;

    expect(loginResponse.headers['cache-control']).toBe('no-store');
    expect(String(loginResponse.headers['set-cookie'] ?? '')).toContain('accessToken=');
    expect(String(loginResponse.headers['set-cookie'] ?? '')).toContain('refreshToken=');
    expect(loginBody.user.email).toBe(email);
    expect(loginBody.user.sessionId).not.toBe(sessionId);

    const refreshResponse = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    const refreshBody = refreshResponse.body as unknown as AuthResponse;

    expect(refreshResponse.headers['cache-control']).toBe('no-store');
    expect(String(refreshResponse.headers['set-cookie'] ?? '')).toContain('accessToken=');
    expect(String(refreshResponse.headers['set-cookie'] ?? '')).toContain('refreshToken=');
    expect(refreshBody.accessToken).toEqual(expect.any(String));
    expect(refreshBody.refreshToken).toEqual(expect.any(String));
    expect(refreshBody.user.email).toBe(email);
    expect(refreshBody.user.sessionId).toBe(sessionId);
    expect(refreshBody.refreshToken).not.toBe(refreshToken);

    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    const logoutResponse = await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${refreshBody.accessToken}`)
      .expect(204);

    expect(logoutResponse.headers['cache-control']).toBe('no-store');

    await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${refreshBody.accessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: refreshBody.refreshToken })
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
          displayName: `Register Attempt ${attempt + 1}`,
        })
        .expect(201);
    }

    const blockedRegisterResponse = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .set('X-Forwarded-For', registerIp)
      .send({
        email: `${registerEmailPrefix}-blocked@example.com`,
        password: 'password123',
        displayName: 'Blocked Register Attempt',
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
          refreshToken: 'invalid-refresh-token-value-1234567890',
        })
        .expect(401);
    }

    const blockedRefreshResponse = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('X-Forwarded-For', refreshIp)
      .send({
        refreshToken: 'invalid-refresh-token-value-1234567890',
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
