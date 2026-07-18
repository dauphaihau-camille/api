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
  userId: string;
};

type WorkspaceResponse = {
  id: string;
  version: number;
  name: string;
  slug: string;
};

type DocumentResponse = {
  id: string;
  version: number;
  workspace_id: string;
  parent_document_id?: string;
  title: string;
  content: unknown[];
  archived_at?: string;
};

let uniqueSequence = 0;

describe('Document mutation flow (e2e)', () => {
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

  it('creates, updates, moves, archives, restores, and permanently deletes documents', async () => {
    const suffix = Date.now();
    const owner = await registerUser('document-mutations-owner');
    const member = await registerUser('document-mutations-member');
    const workspace = await createWorkspace(owner.cookie, {
      name: 'Document Mutations',
      slug: `document-mutations-${suffix}`,
    });

    await request(app.getHttpServer())
      .post(`/v1/workspaces/${workspace.slug}/members`)
      .set('Cookie', owner.cookie)
      .send({
        email: member.email,
        role: 'member',
      })
      .expect(201);

    const parentDocument = await createRootDocument(owner.cookie, {
      workspace_id: workspace.id,
      title: 'Launch Plan',
    });
    const { childDocument, parentDocument: parentAfterSubdoc } = await createSubdocument(
      owner.cookie,
      parentDocument.id,
    );

    expect(childDocument).toMatchObject({
      workspace_id: workspace.id,
      parent_document_id: parentDocument.id,
      title: 'Untitled',
    });

    const updatedParentResponse = await request(app.getHttpServer())
      .patch(`/v1/documents/${parentDocument.id}`)
      .set('Cookie', owner.cookie)
      .send({
        version: parentAfterSubdoc.version,
        title: 'Launch Plan Updated',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Document mutation smoke flow.' }],
        }],
      })
      .expect(200);
    const updatedParent = updatedParentResponse.body as DocumentResponse;

    expect(updatedParent).toMatchObject({
      id: parentDocument.id,
      title: 'Launch Plan Updated',
      workspace_id: workspace.id,
    });
    expect(updatedParent.version).toBeGreaterThan(parentDocument.version);
    expect(updatedParent.content).toEqual([
      expect.objectContaining({ type: 'paragraph' }),
    ]);

    const staleUpdateResponse = await request(app.getHttpServer())
      .patch(`/v1/documents/${parentDocument.id}`)
      .set('Cookie', owner.cookie)
      .send({
        version: parentAfterSubdoc.version,
        title: 'Stale title should fail',
      })
      .expect(409);

    expect(staleUpdateResponse.body).toMatchObject({
      statusCode: 409,
      message: 'Document version conflict.',
    });

    const memberUpdateResponse = await request(app.getHttpServer())
      .patch(`/v1/documents/${parentDocument.id}`)
      .set('Cookie', member.cookie)
      .send({
        version: updatedParent.version,
        title: 'Members cannot edit documents',
      })
      .expect(403);

    expect(memberUpdateResponse.body).toMatchObject({
      statusCode: 403,
      message: 'You do not have permission to update this workspace.',
    });

    const movedChildResponse = await request(app.getHttpServer())
      .post(`/v1/documents/${childDocument.id}/move`)
      .set('Cookie', owner.cookie)
      .send({
        version: childDocument.version,
        parent_document_id: null,
        index: 0,
      })
      .expect(200);
    const movedChild = movedChildResponse.body as DocumentResponse;

    expect(movedChild).toMatchObject({
      id: childDocument.id,
      title: 'Untitled',
    });
    expect(movedChild.parent_document_id).toBeUndefined();
    expect(movedChild.version).toBeGreaterThan(childDocument.version);

    const archivedChild = await archiveDocument(owner.cookie, movedChild);

    expect(archivedChild.archived_at).toEqual(expect.any(String));

    const archivedDocumentsResponse = await request(app.getHttpServer())
      .get(`/v1/workspaces/${workspace.id}/documents/archived`)
      .set('Cookie', owner.cookie)
      .expect(200);
    const archivedListItem = archivedDocumentsResponse.body.items.find(
      (item: { id: string }) => item.id === childDocument.id,
    ) as { id: string; title: string; version: number } | undefined;

    expect(archivedListItem).toMatchObject({
      id: childDocument.id,
      title: 'Untitled',
    });

    const restoredChildResponse = await request(app.getHttpServer())
      .post(`/v1/documents/${childDocument.id}/restore`)
      .set('Cookie', owner.cookie)
      .send({
        version: archivedListItem!.version,
      })
      .expect(200);
    const restoredChild = restoredChildResponse.body as DocumentResponse;

    expect(restoredChild).toMatchObject({
      id: childDocument.id,
      title: 'Untitled',
    });
    expect(restoredChild.archived_at).toBeUndefined();
    expect(restoredChild.version).toBeGreaterThan(archivedChild.version);

    const rearchivedChild = await archiveDocument(owner.cookie, restoredChild);

    await request(app.getHttpServer())
      .delete(`/v1/documents/${childDocument.id}`)
      .query({ version: rearchivedChild.version })
      .set('Cookie', owner.cookie)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/v1/documents/${childDocument.id}`)
      .set('Cookie', owner.cookie)
      .expect(404);
  });

  it('rejects parent_document_id on root document creation', async () => {
    const suffix = `${Date.now()}-${uniqueSequence += 1}`;
    const owner = await registerUser(`doc-root-owner-${suffix}`);
    const workspace = await createWorkspace(owner.cookie, {
      name: 'Document Root Contract',
      slug: `doc-root-${suffix}`,
    });
    const parentDocument = await createRootDocument(owner.cookie, {
      workspace_id: workspace.id,
      title: 'Parent',
    });

    await request(app.getHttpServer())
      .post('/v1/documents')
      .set('Cookie', owner.cookie)
      .send({
        workspace_id: workspace.id,
        parent_document_id: parentDocument.id,
        title: 'Should Fail',
      })
      .expect(400);
  });

  async function registerUser(label: string): Promise<RegisteredUser> {
    const email = `u${Date.now()}-${uniqueSequence += 1}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        password: 'password123',
        display_name: `${label} user`,
      })
      .expect(201);

    const setCookieHeader = response.headers['set-cookie'];
    const authResponse = response.body as AuthResponse;

    return {
      cookie: Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [String(setCookieHeader)],
      email: authResponse.user.email,
      userId: authResponse.user.id,
    };
  }

  async function createWorkspace(
    cookie: string[],
    input: {
      name: string;
      slug: string;
    },
  ): Promise<WorkspaceResponse> {
    const response = await request(app.getHttpServer())
      .post('/v1/workspaces')
      .set('Cookie', cookie)
      .send(input)
      .expect(201);

    return response.body as WorkspaceResponse;
  }

  async function createRootDocument(
    cookie: string[],
    input: {
      workspace_id: string;
      title: string;
    },
  ): Promise<DocumentResponse> {
    const response = await request(app.getHttpServer())
      .post('/v1/documents')
      .set('Cookie', cookie)
      .send(input)
      .expect(201);

    return response.body as DocumentResponse;
  }

  async function createSubdocument(
    cookie: string[],
    parentDocumentId: string,
  ): Promise<{
    childDocument: DocumentResponse;
    parentDocument: DocumentResponse;
  }> {
    const parentResponse = await request(app.getHttpServer())
      .get(`/v1/documents/${parentDocumentId}`)
      .set('Cookie', cookie)
      .expect(200);

    const parentDocument = parentResponse.body as DocumentResponse;
    const response = await request(app.getHttpServer())
      .post(`/v1/documents/${parentDocumentId}/commands/create-subdoc`)
      .set('Cookie', cookie)
      .send({
        version: parentDocument.version,
      })
      .expect(201);

    const body = response.body as {
      child_document: DocumentResponse;
      parent_document: DocumentResponse;
    };

    return {
      childDocument: body.child_document,
      parentDocument: body.parent_document,
    };
  }

  async function archiveDocument(
    cookie: string[],
    document: DocumentResponse,
  ): Promise<DocumentResponse> {
    const response = await request(app.getHttpServer())
      .post(`/v1/documents/${document.id}/archive`)
      .set('Cookie', cookie)
      .send({
        version: document.version,
      })
      .expect(200);

    return response.body as DocumentResponse;
  }
});
