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
import { setupApiDocs } from '../../src/platform/docs/setup-api-docs';
import { setupBullBoard } from '../../src/platform/docs/setup-bull-board';
import { GlobalExceptionFilter } from '../../src/platform/filters/global-exception.filter';
import { RequestLoggingInterceptor } from '../../src/platform/interceptors/request-logging.interceptor';
import { parseCorsAllowedOrigins } from '../../src/platform/config/cors.config';
import type { AuthResponse } from '../../src/domains/auth/app/auth.types';
import { ObservabilityService } from '../../src/platform/observability/observability.service';
import { BULLMQ_QUEUE } from '../../src/integrations/queue/infra/queue.constants';
import { RequestContextService } from '../../src/platform/request-context/request-context.service';
import { createTestDatabase, dropTestDatabase } from '../support/test-postgres';

jest.setTimeout(30_000);

const API_PREFIX = 'v1';
const requireModule = createRequire(__filename);

type RegisteredUser = {
  cookie: string[];
  email: string;
};

type WorkspaceResponse = {
  id: string;
  version: number;
  name: string;
  slug: string;
  description?: string;
  current_user_role: string;
};

describe('Workspace update edge cases (e2e)', () => {
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
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-google-client-secret';
    process.env.GITHUB_OAUTH_CLIENT_ID = 'test-github-client-id';
    process.env.GITHUB_OAUTH_CLIENT_SECRET = 'test-github-client-secret';
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

    process.env = originalEnv;

    if (testDb) {
      await dropTestDatabase(testDb);
    }
  });

  it('validates workspace updates, conflicts, and member permissions', async () => {
    const suffix = Date.now();
    const owner = await registerUser('workspace-update-owner');
    const member = await registerUser('workspace-update-member');
    const primaryWorkspace = await createWorkspace(owner.cookie, {
      name: 'Update Source',
      slug: `update-source-${suffix}`,
      description: 'Original workspace description.',
    });
    const conflictingWorkspace = await createWorkspace(owner.cookie, {
      name: 'Update Target',
      slug: `update-target-${suffix}`,
    });

    const updateResponse = await request(app.getHttpServer())
      .patch(`/v1/workspaces/${primaryWorkspace.slug}`)
      .set('Cookie', owner.cookie)
      .send({
        version: primaryWorkspace.version,
        name: 'Updated Source',
        slug: `updated-source-${suffix}`,
        description: 'Updated workspace description.',
      })
      .expect(200);
    const updatedWorkspace = updateResponse.body as WorkspaceResponse;

    expect(updatedWorkspace).toMatchObject({
      id: primaryWorkspace.id,
      name: 'Updated Source',
      slug: `updated-source-${suffix}`,
      description: 'Updated workspace description.',
      current_user_role: 'owner',
    });
    expect(updatedWorkspace.version).toBe(primaryWorkspace.version + 1);
    expect(updateResponse.headers['cache-control']).toBe('no-store');

    await request(app.getHttpServer())
      .patch(`/v1/workspaces/${updatedWorkspace.slug}`)
      .set('Cookie', owner.cookie)
      .send({
        version: primaryWorkspace.version,
        description: 'This stale update should fail.',
      })
      .expect(409);

    const duplicateSlugResponse = await request(app.getHttpServer())
      .patch(`/v1/workspaces/${updatedWorkspace.slug}`)
      .set('Cookie', owner.cookie)
      .send({
        version: updatedWorkspace.version,
        slug: conflictingWorkspace.slug,
      })
      .expect(409);

    expect(duplicateSlugResponse.body).toMatchObject({
      statusCode: 409,
      message: 'Workspace domain is already in use.',
    });

    const reservedSlugResponse = await request(app.getHttpServer())
      .patch(`/v1/workspaces/${updatedWorkspace.slug}`)
      .set('Cookie', owner.cookie)
      .send({
        version: updatedWorkspace.version,
        slug: 'settings',
      })
      .expect(409);

    expect(reservedSlugResponse.body).toMatchObject({
      statusCode: 409,
      message: 'Workspace domain is reserved.',
    });

    const invalidSlugResponse = await request(app.getHttpServer())
      .patch(`/v1/workspaces/${updatedWorkspace.slug}`)
      .set('Cookie', owner.cookie)
      .send({
        version: updatedWorkspace.version,
        slug: 'bad slug',
      })
      .expect(400);

    expect(invalidSlugResponse.body).toMatchObject({
      statusCode: 400,
      message: 'Workspace domain is invalid.',
    });

    await request(app.getHttpServer())
      .post(`/v1/workspaces/${updatedWorkspace.slug}/members`)
      .set('Cookie', owner.cookie)
      .send({
        email: member.email,
        role: 'member',
      })
      .expect(201);

    const memberUpdateResponse = await request(app.getHttpServer())
      .patch(`/v1/workspaces/${updatedWorkspace.slug}`)
      .set('Cookie', member.cookie)
      .send({
        version: updatedWorkspace.version,
        description: 'Members cannot update workspace settings.',
      })
      .expect(403);

    expect(memberUpdateResponse.body).toMatchObject({
      statusCode: 403,
      message: 'You do not have permission to update this workspace.',
    });
  });

  async function registerUser(label: string): Promise<RegisteredUser> {
    const email = `${label}-${Date.now()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        password: 'password123',
        display_name: `${label} user`,
      })
      .expect(201);

    const setCookieHeader = response.headers['set-cookie'];

    return {
      cookie: Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [String(setCookieHeader)],
      email: (response.body as AuthResponse).user.email,
    };
  }

  async function createWorkspace(
    cookie: string[],
    input: {
      name: string;
      slug: string;
      description?: string;
    },
  ): Promise<WorkspaceResponse> {
    const response = await request(app.getHttpServer())
      .post('/v1/workspaces')
      .set('Cookie', cookie)
      .send(input)
      .expect(201);

    return response.body as WorkspaceResponse;
  }
});
