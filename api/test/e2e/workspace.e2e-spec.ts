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
    process.env.CACHE_DRIVER = 'memory';
    process.env.RATE_LIMIT_DRIVER = 'memory';
    process.env.QUEUE_DRIVER = 'inline';
    process.env.STORAGE_DRIVER = 'local';
    const { AppModule } = requireModule('../../src/bootstrap/app.module');

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

  it('creates and edits teamspaces and documents through the API', async () => {
    const owner = await registerUser('documents-owner');

    const createWorkspaceResponse = await request(app.getHttpServer())
      .post('/v1/workspaces')
      .set('Cookie', owner.cookie)
      .send({
        name: 'Camille Docs',
        slug: 'camille-docs',
      })
      .expect(201);
    const workspace = createWorkspaceResponse.body as {
      id: string;
      slug: string;
    };

    const createTeamspaceResponse = await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspace.slug}/teamspaces`)
      .set('Cookie', owner.cookie)
      .send({
        name: 'Product',
        description: 'Shared product docs',
      })
      .expect(201);
    const teamspace = createTeamspaceResponse.body as {
      id: string;
      version: number;
      name: string;
    };

    expect(teamspace).toMatchObject({
      name: 'Product',
    });

    const updateTeamspaceResponse = await request(app.getHttpServer())
      .patch(`/v1/teamspaces/${teamspace.id}`)
      .set('Cookie', owner.cookie)
      .send({
        version: teamspace.version,
        description: 'Shared planning and product docs',
      })
      .expect(200);

    expect(updateTeamspaceResponse.body).toMatchObject({
      id: teamspace.id,
      description: 'Shared planning and product docs',
    });

    const createPrivateDocumentResponse = await request(app.getHttpServer())
      .post('/v1/documents')
      .set('Cookie', owner.cookie)
      .send({
        workspace_id: workspace.slug,
        title: 'Roadmap',
        content_format: 'blocknote_v1',
        content: [{ type: 'paragraph', content: [] }],
      })
      .expect(201);
    const privateDocument = createPrivateDocumentResponse.body as {
      id: string;
      version: number;
      title: string;
    };

    expect(privateDocument).toMatchObject({
      title: 'Roadmap',
    });

    const createTeamspaceDocumentResponse = await request(app.getHttpServer())
      .post('/v1/documents')
      .set('Cookie', owner.cookie)
      .send({
        workspace_id: workspace.slug,
        teamspace_id: teamspace.id,
        title: 'Shared spec',
        content_format: 'blocknote_v1',
        content: [{ type: 'paragraph', content: [] }],
      })
      .expect(201);
    const sharedDocument = createTeamspaceDocumentResponse.body as {
      id: string;
      version: number;
      title: string;
      teamspace_id?: string;
    };

    expect(sharedDocument).toMatchObject({
      title: 'Shared spec',
      teamspace_id: teamspace.id,
    });

    const treeResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspace.slug}/documents`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(treeResponse.body.private_documents.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: privateDocument.id,
          title: 'Roadmap',
        }),
      ]),
    );
    expect(treeResponse.body.teamspaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: teamspace.id,
          documents: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({
                id: sharedDocument.id,
                title: 'Shared spec',
              }),
            ]),
          }),
        }),
      ]),
    );

    const updateDocumentResponse = await request(app.getHttpServer())
      .patch(`/v1/documents/${privateDocument.id}`)
      .set('Cookie', owner.cookie)
      .send({
        version: privateDocument.version,
        title: 'Updated roadmap',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ready' }] }],
      })
      .expect(200);

    expect(updateDocumentResponse.body).toMatchObject({
      id: privateDocument.id,
      title: 'Updated roadmap',
    });

    const moveDocumentResponse = await request(app.getHttpServer())
      .post(`/v1/documents/${privateDocument.id}/move`)
      .set('Cookie', owner.cookie)
      .send({
        version: updateDocumentResponse.body.version,
        teamspace_id: teamspace.id,
      })
      .expect(200);

    expect(moveDocumentResponse.body).toMatchObject({
      id: privateDocument.id,
      teamspace_id: teamspace.id,
    });

    const archiveDocumentResponse = await request(app.getHttpServer())
      .post(`/v1/documents/${sharedDocument.id}/archive`)
      .set('Cookie', owner.cookie)
      .send({
        version: sharedDocument.version,
      })
      .expect(200);

    expect(archiveDocumentResponse.body.archived_at).toEqual(expect.any(String));

    const archivedDocumentDetailResponse = await request(app.getHttpServer())
      .get(`/v1/documents/${sharedDocument.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const restoreDocumentResponse = await request(app.getHttpServer())
      .post(`/v1/documents/${sharedDocument.id}/restore`)
      .set('Cookie', owner.cookie)
      .send({
        version: archivedDocumentDetailResponse.body.version,
      })
      .expect(200);

    expect(restoreDocumentResponse.body.archived_at).toBeUndefined();

    const detailResponse = await request(app.getHttpServer())
      .get(`/v1/documents/${privateDocument.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(detailResponse.body).toMatchObject({
      id: privateDocument.id,
      title: 'Updated roadmap',
      teamspace_id: teamspace.id,
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
