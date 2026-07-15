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
  userId: string;
};

describe('Document flow (e2e)', () => {
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
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
        { path: 'metrics', method: RequestMethod.GET },
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

  it('supports favorite, search, publish, and recent access flows', async () => {
    const owner = await registerUser('owner');

    const createWorkspaceResponse = await request(app.getHttpServer())
      .post('/v1/workspaces')
      .set('Cookie', owner.cookie)
      .send({
        name: 'Camille Workspace',
        slug: 'camille-workspace',
      })
      .expect(201);
    const workspace = createWorkspaceResponse.body as { id: string; slug: string };

    const createDocumentResponse = await request(app.getHttpServer())
      .post('/v1/documents')
      .set('Cookie', owner.cookie)
      .send({
        workspace_id: workspace.id,
        title: 'Weekly review',
      })
      .expect(201);
    const document = createDocumentResponse.body as { id: string };

    await request(app.getHttpServer())
      .get(`/v1/documents/${document.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const favoriteResponse = await request(app.getHttpServer())
      .post(`/v1/documents/${document.id}/favorite`)
      .set('Cookie', owner.cookie)
      .expect(201);

    expect(favoriteResponse.body).toMatchObject({
      document_id: document.id,
      is_favorite: true,
    });

    const favoritesResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspace.slug}/favorites`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(favoritesResponse.body).toEqual([
      expect.objectContaining({
        document_id: document.id,
        title: 'Weekly review',
        has_children: false,
        has_content: false,
      }),
    ]);

    const favoriteStatusResponse = await request(app.getHttpServer())
      .get(`/v1/documents/${document.id}/favorite`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(favoriteStatusResponse.body).toMatchObject({
      document_id: document.id,
      is_favorite: true,
    });

    const searchParams = new URLSearchParams();
    searchParams.set('q', 'Weekly');

    const searchByTitleResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspace.id}/search/documents`)
      .query(searchParams)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(searchByTitleResponse.body).toEqual([
      expect.objectContaining({
        document_id: document.id,
        title: 'Weekly review',
      }),
    ]);

    const recentDocumentsResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspace.id}/search/documents`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(recentDocumentsResponse.body).toEqual([
      expect.objectContaining({
        document_id: document.id,
        visited_at: expect.any(String),
      }),
    ]);

    const publishResponse = await request(app.getHttpServer())
      .post(`/v1/documents/${document.id}/publish`)
      .set('Cookie', owner.cookie)
      .expect(201);

    expect(publishResponse.body).toMatchObject({
      document_id: document.id,
      public_path: expect.stringMatching(/^\/share\//),
      published_document_id: expect.any(String),
    });

    const publishedDocumentId = publishResponse.body.published_document_id as string;

    const publishStatusResponse = await request(app.getHttpServer())
      .get(`/v1/documents/${document.id}/publish`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(publishStatusResponse.body).toMatchObject({
      document_id: document.id,
      published_document_id: publishedDocumentId,
    });

    const publicDocumentResponse = await request(app.getHttpServer())
      .get(`/v1/published/${publishedDocumentId}`)
      .expect(200);

    expect(publicDocumentResponse.body).toMatchObject({
      id: document.id,
      title: 'Weekly review',
      content_format: 'blocknote_v1',
    });

    await request(app.getHttpServer())
      .delete(`/v1/documents/${document.id}/favorite`)
      .set('Cookie', owner.cookie)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/v1/documents/${document.id}/publish`)
      .set('Cookie', owner.cookie)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/v1/published/${publishedDocumentId}`)
      .expect(404);
  });

  async function registerUser(name: string, email = `${name}-${Date.now()}@example.com`) {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        password: 'password123',
        display_name: `${name} user`,
      })
      .expect(201);
    const body = response.body as unknown as AuthResponse;
    const setCookieHeader = response.headers['set-cookie'];
    const cookie = Array.isArray(setCookieHeader) ? setCookieHeader : [String(setCookieHeader)];

    return {
      cookie,
      userId: body.user.id,
    } satisfies RegisteredUser;
  }
});
