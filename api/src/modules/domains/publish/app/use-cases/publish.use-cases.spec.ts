import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { UserStatus } from '~/modules/domains/auth/domain/enums/user-status.enum';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { AuditService } from '~/modules/shared/audit/audit.service';
import {
  ArchivedDocumentPublicAccessDeniedError,
  PublishPermissionDeniedError,
} from '../errors/publish-app.error';
import type { PublishRepository } from '../ports/publish.repository';
import { GetPublicDocumentUseCase } from './get-public-document.use-case';
import { PublishDocumentUseCase } from './publish-document.use-case';

describe('Publish use cases', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  function createWorkspaceRepository(role = WorkspaceRole.OWNER) {
    return {
      findAllForUser: jest.fn().mockResolvedValue([
        {
          id: 'workspace-1',
          version: 1,
          slug: 'workspace-1',
          name: 'Workspace 1',
          description: undefined,
          currentUserRole: role,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    } as unknown as jest.Mocked<WorkspaceRepository>;
  }

  function createPublishRepository() {
    return {
      findDocument: jest.fn(),
      findPublishedDocumentByDocumentId: jest.fn(),
      findPublishedDocumentById: jest.fn(),
      publishDocument: jest.fn(),
      unpublishDocument: jest.fn(),
    } as unknown as jest.Mocked<PublishRepository>;
  }

  function createAuditService() {
    return {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
  }

  it('records an audit event only when a publish is newly created', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const publishRepository = createPublishRepository();
    const auditService = createAuditService();
    const document = {
      id: 'document-1',
      workspace: { id: 'workspace-1' },
    };
    const publishedDocument = {
      id: 'published-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    publishRepository.findDocument.mockResolvedValue(document as never);
    publishRepository.publishDocument.mockResolvedValue({
      publishedDocument: publishedDocument as never,
      created: true,
    });

    const useCase = new PublishDocumentUseCase(
      workspaceRepository,
      publishRepository,
      auditService,
    );

    const result = await useCase.execute('document-1', currentUser);

    expect(result).toEqual({
      documentId: 'document-1',
      publishedDocumentId: 'published-1',
      publishedAt: publishedDocument.createdAt,
      publicPath: '/share/published-1',
    });
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'document.published',
      resourceId: 'document-1',
    }));
  });

  it('rejects publish when the user cannot edit the workspace', async () => {
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.MEMBER);
    const publishRepository = createPublishRepository();
    const auditService = createAuditService();

    publishRepository.findDocument.mockResolvedValue({
      id: 'document-1',
      workspace: { id: 'workspace-1' },
    } as never);

    const useCase = new PublishDocumentUseCase(
      workspaceRepository,
      publishRepository,
      auditService,
    );

    await expect(useCase.execute('document-1', currentUser))
      .rejects
      .toBeInstanceOf(PublishPermissionDeniedError);
  });

  it('blocks public access to archived documents', async () => {
    const publishRepository = createPublishRepository();

    publishRepository.findPublishedDocumentById.mockResolvedValue({
      id: 'published-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      document: {
        id: 'document-1',
        title: 'Archived',
        contentFormat: 'blocknote_v1',
        contentJson: [],
        archivedAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-03T00:00:00.000Z'),
      },
    } as never);

    const useCase = new GetPublicDocumentUseCase(publishRepository);

    await expect(useCase.execute('published-1'))
      .rejects
      .toBeInstanceOf(ArchivedDocumentPublicAccessDeniedError);
  });
});
