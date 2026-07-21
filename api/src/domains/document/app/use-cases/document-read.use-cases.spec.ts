import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import type { PublishRepository } from '../../../publish/app/ports/publish.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentObservabilityService } from '../../observability/document-observability.service';
import type { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import type { DocumentTreeQueryRepository } from '../ports/document-tree-query.repository';
import type { DocumentVisitRepository } from '../ports/document-visit.repository';
import { DocumentAccessResolver } from '../policies/document-access.resolver';
import { GetDefaultWorkspaceDocumentUseCase } from './get-default-workspace-document.use-case';
import { GetDocumentUseCase } from './get-document.use-case';
import { ListWorkspaceDocumentsUseCase } from './list-workspace-documents.use-case';
import { DocumentNotFoundError } from '../errors/document-app.error';

describe('Document read use cases', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  function createWorkspaceRepository(
    currentUserRole: WorkspaceRole = WorkspaceRole.OWNER,
  ) {
    return {
      findAllForUser: jest.fn().mockResolvedValue([
        {
          id: 'workspace-1',
          version: 1,
          slug: 'workspace-1',
          name: 'Workspace 1',
          description: undefined,
          currentUserRole,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    } as unknown as jest.Mocked<WorkspaceRepository>;
  }

  function createNavigationRepository() {
    return {
      findDocument: jest.fn(),
      findDocumentByIdInWorkspace: jest.fn(),
      findTeamspaces: jest.fn(),
      findRootDocuments: jest.fn(),
      findChildren: jest.fn(),
      countActiveChildren: jest.fn(),
      findFavoriteDocumentIds: jest.fn(),
      findAncestors: jest.fn(),
    } as unknown as jest.Mocked<DocumentNavigationQueryRepository>;
  }

  function createVisitRepository() {
    return {
      findRecentVisit: jest.fn(),
      recordVisit: jest.fn(),
    } as unknown as jest.Mocked<DocumentVisitRepository>;
  }

  function createTreeRepository() {
    return {
      findDescendants: jest.fn(),
      findActiveSubtreeDocuments: jest.fn(),
      findSiblingDocumentsForMove: jest.fn(),
      findFirstSibling: jest.fn(),
    } as unknown as jest.Mocked<DocumentTreeQueryRepository>;
  }

  function createPublishRepository() {
    return {
      findPublishedDocumentByDocumentId: jest.fn(),
    } as unknown as jest.Mocked<PublishRepository>;
  }

  function createObservabilityService() {
    return {
      recordDocumentReadDuration: jest.fn(),
      recordDocumentVisitRecording: jest.fn(),
      logDocumentVisitRecordingFailure: jest.fn(),
    } as unknown as jest.Mocked<DocumentObservabilityService>;
  }

  it('passes a title search filter when listing workspace documents', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const navigationRepository = createNavigationRepository();
    navigationRepository.findTeamspaces.mockResolvedValue([]);
    navigationRepository.findRootDocuments.mockResolvedValue([]);
    navigationRepository.countActiveChildren.mockResolvedValue(0);
    navigationRepository.findFavoriteDocumentIds.mockResolvedValue([]);

    const useCase = new ListWorkspaceDocumentsUseCase(
      workspaceRepository,
      navigationRepository,
      new DocumentAccessResolver(),
    );

    await useCase.execute('workspace-1', currentUser, {
      limit: 50,
      query: 'page',
    });

    expect(navigationRepository.findRootDocuments).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      teamspaceId: null,
      parentDocumentId: null,
      query: 'page',
    });
  });

  it('falls back to the first available root document when recent is missing', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const navigationRepository = createNavigationRepository();
    const visitRepository = createVisitRepository();
    const treeRepository = createTreeRepository();
    navigationRepository.findDocumentByIdInWorkspace.mockResolvedValue(null);
    visitRepository.findRecentVisit.mockResolvedValue(null);
    treeRepository.findFirstSibling
      .mockResolvedValueOnce({ id: 'document-private' } as never);
    navigationRepository.findTeamspaces.mockResolvedValue([]);

    const useCase = new GetDefaultWorkspaceDocumentUseCase(
      workspaceRepository,
      navigationRepository,
      visitRepository,
      treeRepository,
      new DocumentAccessResolver(),
    );

    const result = await useCase.execute('workspace-1', currentUser, 'document-recent');

    expect(navigationRepository.findDocumentByIdInWorkspace).toHaveBeenCalledWith({
      documentId: 'document-recent',
      workspaceId: 'workspace-1',
      archivedAt: null,
    });
    expect(result).toEqual({ documentId: 'document-private' });
  });

  it('returns document detail without waiting for visit recording', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const navigationRepository = createNavigationRepository();
    const visitRepository = createVisitRepository();
    const publishRepository = createPublishRepository();
    const observabilityService = createObservabilityService();
    const visitPromise = new Promise<void>(() => {});
    const documentCreatedAt = new Date('2026-01-01T00:00:00.000Z');
    const documentUpdatedAt = new Date('2026-01-02T00:00:00.000Z');
    const document = {
      id: 'document-1',
      publicId: 'public-document-1',
      version: 3,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      title: 'Document 1',
      contentFormat: 'blocknote_v1',
      contentJson: [],
      sortKey: 10,
      archivedAt: undefined,
      ownerUser: { id: 'user-1' },
      createdAt: documentCreatedAt,
      updatedAt: documentUpdatedAt,
      updatedBy: {
        displayName: 'Editor',
        email: 'editor@example.com',
      },
    };

    navigationRepository.findDocument.mockResolvedValue(document as never);
    navigationRepository.findFavoriteDocumentIds.mockResolvedValue(['document-1']);
    navigationRepository.findAncestors.mockResolvedValue([]);
    publishRepository.findPublishedDocumentByDocumentId.mockResolvedValue(null);
    visitRepository.recordVisit.mockReturnValue(visitPromise);

    const useCase = new GetDocumentUseCase(
      workspaceRepository,
      navigationRepository,
      visitRepository,
      publishRepository,
      observabilityService,
      new DocumentAccessResolver(),
    );

    const result = await useCase.execute('document-1', currentUser);

    expect(result).toEqual({
      id: 'document-1',
      publicId: 'public-document-1',
      version: 3,
      workspaceId: 'workspace-1',
      ownerUserId: 'user-1',
      teamspaceId: undefined,
      parentDocumentId: undefined,
      title: 'Document 1',
      contentFormat: 'blocknote_v1',
      content: [],
      sortKey: 10,
      archivedAt: undefined,
      archivedByName: undefined,
      createdAt: documentCreatedAt,
      updatedAt: documentUpdatedAt,
      isFavorite: true,
      publishedDocumentId: undefined,
      publicPath: undefined,
      breadcrumb: [],
    });
    expect(visitRepository.recordVisit).toHaveBeenCalledWith({
      documentId: document.id,
      workspaceId: document.workspace.id,
      userId: currentUser.userId,
    });
    expect(observabilityService.recordDocumentReadDuration).toHaveBeenCalledWith(
      'workspace_access',
      expect.any(Number),
    );
    expect(observabilityService.recordDocumentReadDuration).toHaveBeenCalledWith(
      'related_queries',
      expect.any(Number),
    );
    expect(observabilityService.recordDocumentReadDuration).toHaveBeenCalledWith(
      'total',
      expect.any(Number),
    );
  });

  it('hides another user private document from a workspace member', async () => {
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.MEMBER);
    const navigationRepository = createNavigationRepository();
    const visitRepository = createVisitRepository();
    const publishRepository = createPublishRepository();
    const observabilityService = createObservabilityService();
    const document = {
      id: 'private-document',
      publicId: 'private-document-public-id',
      version: 1,
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      title: 'Another user private document',
      contentFormat: 'blocknote_v1',
      contentJson: [],
      sortKey: 1,
      archivedAt: undefined,
      createdBy: { id: 'another-user' },
      ownerUser: { id: 'another-user' },
      updatedBy: {
        displayName: 'Another user',
        email: 'another@example.com',
      },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    navigationRepository.findDocument.mockResolvedValue(document as never);
    navigationRepository.findFavoriteDocumentIds.mockResolvedValue([]);
    navigationRepository.findAncestors.mockResolvedValue([]);
    publishRepository.findPublishedDocumentByDocumentId.mockResolvedValue(null);
    visitRepository.recordVisit.mockResolvedValue(undefined);

    const useCase = new GetDocumentUseCase(
      workspaceRepository,
      navigationRepository,
      visitRepository,
      publishRepository,
      observabilityService,
      new DocumentAccessResolver(),
    );

    await expect(useCase.execute(document.id, currentUser)).rejects.toBeInstanceOf(DocumentNotFoundError);

    expect(workspaceRepository.findAllForUser).toHaveBeenCalledWith(currentUser.userId);
    expect(visitRepository.recordVisit).not.toHaveBeenCalled();
  });
});
