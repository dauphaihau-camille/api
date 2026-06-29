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
import type { AuthResponse } from '../../src/modules/domains/auth/app/auth.types';
import { ObservabilityService } from '../../src/modules/shared/observability/observability.service';
import { BULLMQ_QUEUE } from '../../src/modules/shared/queue/infra/queue.constants';
import { RequestContextService } from '../../src/modules/shared/request-context/request-context.service';
import { createTestDatabase, dropTestDatabase } from '../support/test-postgres';

jest.setTimeout(30_000);

const API_PREFIX = 'v1';

type RegisteredUser = {
  cookie: string[];
  userId: string;
};

describe('Workspace and membership flow (e2e)', () => {
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
    const { AppModule } = require('../../src/modules/app.module') as typeof import('../../src/modules/app.module');

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

  it('creates a workspace and manages members through the API', async () => {
    const owner = await registerUser('owner');
    const inviteeEmail = `invitee-${Date.now()}@example.com`;

    await registerUser('invitee', inviteeEmail);

    const createWorkspaceResponse = await request(app.getHttpServer())
      .post('/v1/workspaces')
      .set('Cookie', owner.cookie)
      .send({
        name: 'Camille Product',
        slug: 'camille-product',
        description: 'Shared docs and planning.',
      })
      .expect(201);
    const workspace = createWorkspaceResponse.body as {
      id: string;
      version: number;
      name: string;
      slug: string;
      current_user_role: string;
    };

    expect(workspace).toMatchObject({
      name: 'Camille Product',
      slug: 'camille-product',
      current_user_role: 'owner',
    });

    const myWorkspacesResponse = await request(app.getHttpServer())
      .get('/v1/me/workspaces')
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(myWorkspacesResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: workspace.id,
          current_user_role: 'owner',
        }),
      ]),
    );

    const detailResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspace.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(detailResponse.body).toMatchObject({
      id: workspace.id,
      name: 'Camille Product',
      description: 'Shared docs and planning.',
    });

    const detailBySlugResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspace.slug}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(detailBySlugResponse.body).toMatchObject({
      id: workspace.id,
      slug: 'camille-product',
    });

    const addMemberResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspace.slug}/members`)
      .set('Cookie', owner.cookie)
      .send({
        email: inviteeEmail,
        role: 'member',
      })
      .expect(201);
    const member = addMemberResponse.body as {
      id: string;
      version: number;
      email: string;
      role: string;
    };

    expect(member).toMatchObject({
      email: inviteeEmail,
      role: 'member',
    });

    const listMembersResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspace.slug}/members`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(listMembersResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: owner.userId,
          role: 'owner',
        }),
        expect.objectContaining({
          id: member.id,
          email: inviteeEmail,
          role: 'member',
        }),
      ]),
    );

    const updateMemberResponse = await request(app.getHttpServer())
      .patch(`/v1/workspaces/${workspace.slug}/members/${member.id}`)
      .set('Cookie', owner.cookie)
      .send({
        version: member.version,
        role: 'admin',
      })
      .expect(200);

    expect(updateMemberResponse.body).toMatchObject({
      id: member.id,
      role: 'admin',
    });

    await request(app.getHttpServer())
      .delete(`/v1/workspaces/${workspace.slug}/members/${member.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const membersAfterRemovalResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspace.slug}/members`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(membersAfterRemovalResponse.body).toHaveLength(1);
    expect(membersAfterRemovalResponse.body[0]).toMatchObject({
      user_id: owner.userId,
      role: 'owner',
    });
  });

  async function registerUser(
    label: string,
    email = `${label}-${Date.now()}@example.com`,
  ): Promise<RegisteredUser> {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        password: 'password123',
        display_name: `${label} user`,
      })
      .expect(201);
    const body = response.body as AuthResponse;

    return {
      cookie: Array.isArray(response.headers['set-cookie'])
        ? response.headers['set-cookie']
        : [],
      userId: body.user.id,
    };
  }
});
