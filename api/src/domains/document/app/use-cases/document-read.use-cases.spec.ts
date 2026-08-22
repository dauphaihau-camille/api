import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import { TeamspaceAccessMode } from '../../../teamspace/domain/enums/teamspace-access-mode.enum';
import { TeamspaceMemberRole } from '../../../teamspace/domain/enums/teamspace-member-role.enum';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentObservabilityService } from '../../observability/document-observability.service';
import type { DocumentSummary } from '../contracts/document.contract';
import type { DocumentDetailQueryRepository } from '../ports/document-detail-query.repository';
import type { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import type { DocumentTreeQueryRepository } from '../ports/document-tree-query.repository';
import type { DocumentVisitRepository } from '../ports/document-visit.repository';
import type { DocumentAccessGrantRepository } from '../ports/document-access-grant.repository';
import type { DocumentAccessSettingRepository } from '../ports/document-access-setting.repository';
import { DocumentAccessGrantPermission } from '../../domain/enums/document-access-grant-permission.enum';
import { DocumentAccessResolver } from '../policies/document-access.resolver';
import { GetDefaultWorkspaceDocumentUseCase } from './get-default-workspace-document.use-case';
import { GetDocumentUseCase } from './get-document.use-case';
import { ListDocumentChildrenUseCase } from './list-document-children.use-case';
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
    const workspace = {
      id: 'workspace-1',
      version: 1,
      slug: 'workspace-1',
      name: 'Workspace 1',
      description: undefined,
      currentUserRole,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    return {
      findAllForUser: jest.fn().mockResolvedValue([workspace]),
      findById: jest.fn().mockResolvedValue(workspace),
      findWorkspaceAccess: jest.fn().mockResolvedValue({
        workspace,
        membership: {
          id: 'membership-1',
          version: 1,
          userId: currentUser.userId,
          email: currentUser.email,
          role: currentUserRole,
          joinedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      }),
    } as unknown as jest.Mocked<WorkspaceRepository>;
  }

  function createNavigationRepository() {
    return {
      findDocument: jest.fn(),
      findDocumentByIdInWorkspace: jest.fn(),
      findTeamspaces: jest.fn(),
      findTeamspaceMemberRolesByTeamspaceId: jest.fn().mockResolvedValue(new Map()),
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

  function createDocumentDetailQueryRepository() {
    return {
      findDocumentDetail: jest.fn(),
    } as unknown as jest.Mocked<DocumentDetailQueryRepository>;
  }

  function createDocumentSummary(
    overrides: Partial<DocumentSummary> = {},
  ): DocumentSummary {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');

    return {
      id: 'document-1',
      publicId: 'public-document-1',
      version: 3,
      workspaceId: 'workspace-1',
      ownerUserId: 'user-1',
      ownerUser: {
        id: 'user-1',
        email: currentUser.email,
        displayName: undefined,
      },
      teamspaceId: undefined,
      parentDocumentId: undefined,
      title: 'Document 1',
      contentFormat: 'blocknote_v1',
      content: [],
      sortKey: 10,
      archivedAt: undefined,
      archivedByName: undefined,
      createdAt,
      updatedAt,
      isFavorite: false,
      publishedDocumentId: undefined,
      publicPath: undefined,
      breadcrumb: [],
      access: {
        scope: 'private',
        permission: 'manage',
        canView: true,
        canEdit: true,
        canManage: true,
        workspaceMemberPermission: undefined,
      },
      collaboration: {
        enabled: false,
        mode: 'edit',
        showPresence: false,
      },
      ...overrides,
    };
  }

  function createTreeRepository() {
    return {
      findDescendants: jest.fn(),
      findActiveSubtreeDocuments: jest.fn(),
      findSiblingDocumentsForMove: jest.fn(),
      findFirstSibling: jest.fn(),
    } as unknown as jest.Mocked<DocumentTreeQueryRepository>;
  }

  function createObservabilityService() {
    return {
      recordDocumentReadDuration: jest.fn(),
      recordDocumentVisitRecording: jest.fn(),
      logDocumentVisitRecordingFailure: jest.fn(),
    } as unknown as jest.Mocked<DocumentObservabilityService>;
  }

  function createAccessGrantRepository() {
    return {
      findActiveGrant: jest.fn().mockResolvedValue(null),
      findStrongestActiveGrantInAncestors: jest.fn().mockResolvedValue(null),
      findActiveGrantPermissionsByDocumentId: jest.fn().mockResolvedValue(new Map()),
      findStrongestActiveGrantPermissionsInAncestorsByDocumentId: jest.fn().mockResolvedValue(new Map()),
      hasActiveGrants: jest.fn().mockResolvedValue(false),
      hasActiveGrantsIncludingAncestors: jest.fn().mockResolvedValue(false),
      findDocumentIdsWithActiveGrantsIncludingAncestors: jest.fn().mockResolvedValue(new Set()),
    } as unknown as jest.Mocked<DocumentAccessGrantRepository>;
  }

  function createAccessSettingRepository() {
    return {
      findByDocumentId: jest.fn().mockResolvedValue(null),
      findWorkspaceMemberPermissionsByDocumentId: jest.fn().mockResolvedValue(new Map()),
    } as unknown as jest.Mocked<DocumentAccessSettingRepository>;
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
      createAccessGrantRepository(),
      createAccessSettingRepository(),
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

  it('lists child documents for a workspace member under an open teamspace document', async () => {
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.MEMBER);
    const navigationRepository = createNavigationRepository();
    const teamspace = {
      id: 'teamspace-1',
      accessMode: TeamspaceAccessMode.OPEN,
    };
    const parentDocument = {
      id: 'parent-document',
      workspace: { id: 'workspace-1' },
      teamspace,
      ownerUser: { id: 'another-user' },
    };
    const childDocument = {
      id: 'child-document',
      publicId: 'child-public-id',
      workspace: { id: 'workspace-1' },
      teamspace,
      parentDocument: { id: 'parent-document' },
      ownerUser: { id: 'another-user' },
      title: 'Release Checklist',
      contentJson: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ship it' }] }],
      sortKey: 1,
    };

    navigationRepository.findDocument.mockResolvedValue(parentDocument as never);
    navigationRepository.findRootDocuments.mockResolvedValue([childDocument] as never);
    navigationRepository.countActiveChildren.mockResolvedValue(0);
    navigationRepository.findFavoriteDocumentIds.mockResolvedValue([]);

    const useCase = new ListWorkspaceDocumentsUseCase(
      workspaceRepository,
      navigationRepository,
      new DocumentAccessResolver(),
      createAccessGrantRepository(),
      createAccessSettingRepository(),
    );

    await expect(useCase.execute('workspace-1', currentUser, {
      parentDocumentId: 'parent-document',
      limit: 50,
    })).resolves.toEqual({
      items: [
        {
          id: 'child-document',
          publicId: 'child-public-id',
          accessScope: 'teamspace',
          title: 'Release Checklist',
          teamspaceId: 'teamspace-1',
          parentDocumentId: 'parent-document',
          sortKey: 1,
          hasChildren: false,
          hasContent: true,
          isFavorite: false,
          isOwnedByCurrentUser: false,
        },
      ],
      nextCursor: undefined,
    });
  });

  it('excludes workspace-wide shared root documents from private and invited shared navigation nodes', async () => {
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.MEMBER);
    const navigationRepository = createNavigationRepository();
    const accessSettingRepository = createAccessSettingRepository();
    const sharedDocument = {
      id: 'shared-document',
      publicId: 'shared-document-public',
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      ownerUser: { id: 'another-user' },
      title: 'Workspace shared plan',
      contentJson: [{ type: 'paragraph', content: [{ type: 'text', text: 'Plan' }] }],
      sortKey: 1,
    };

    navigationRepository.findTeamspaces.mockResolvedValue([]);
    navigationRepository.findRootDocuments.mockResolvedValue([sharedDocument] as never);
    navigationRepository.countActiveChildren.mockResolvedValue(0);
    navigationRepository.findFavoriteDocumentIds.mockResolvedValue([]);
    accessSettingRepository.findWorkspaceMemberPermissionsByDocumentId.mockResolvedValue(
      new Map([['shared-document', DocumentAccessGrantPermission.VIEW]]),
    );

    const useCase = new ListWorkspaceDocumentsUseCase(
      workspaceRepository,
      navigationRepository,
      new DocumentAccessResolver(),
      createAccessGrantRepository(),
      accessSettingRepository,
    );

    await expect(useCase.execute('workspace-1', currentUser, {
      limit: 50,
    })).resolves.toMatchObject({
      privateDocuments: {
        items: [],
      },
      sharedDocuments: {
        items: [],
      },
    });
  });

  it('lists direct grant root documents in shared navigation', async () => {
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.MEMBER);
    const navigationRepository = createNavigationRepository();
    const accessGrantRepository = createAccessGrantRepository();
    const sharedDocument = {
      id: 'direct-shared-document',
      publicId: 'direct-shared-document-public',
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      ownerUser: { id: 'another-user' },
      title: 'Direct shared plan',
      contentJson: [{ type: 'paragraph', content: [{ type: 'text', text: 'Plan' }] }],
      sortKey: 1,
    };

    navigationRepository.findTeamspaces.mockResolvedValue([]);
    navigationRepository.findRootDocuments.mockResolvedValue([sharedDocument] as never);
    navigationRepository.countActiveChildren.mockResolvedValue(0);
    navigationRepository.findFavoriteDocumentIds.mockResolvedValue([]);
    accessGrantRepository.findActiveGrantPermissionsByDocumentId.mockResolvedValue(
      new Map([['direct-shared-document', DocumentAccessGrantPermission.VIEW]]),
    );

    const useCase = new ListWorkspaceDocumentsUseCase(
      workspaceRepository,
      navigationRepository,
      new DocumentAccessResolver(),
      accessGrantRepository,
      createAccessSettingRepository(),
    );

    await expect(useCase.execute('workspace-1', currentUser, {
      limit: 50,
    })).resolves.toMatchObject({
      privateDocuments: {
        items: [],
      },
      sharedDocuments: {
        items: [
          {
            id: 'direct-shared-document',
            accessScope: 'shared',
            isOwnedByCurrentUser: false,
          },
        ],
      },
    });
  });

  it('lists owner-owned root documents with active direct grants in shared navigation', async () => {
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.MEMBER);
    const navigationRepository = createNavigationRepository();
    const accessGrantRepository = createAccessGrantRepository();
    const sharedDocument = {
      id: 'owner-direct-shared-document',
      publicId: 'owner-direct-shared-document-public',
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      ownerUser: { id: currentUser.userId },
      title: 'Owner shared plan',
      contentJson: [{ type: 'paragraph', content: [{ type: 'text', text: 'Plan' }] }],
      sortKey: 1,
    };

    navigationRepository.findTeamspaces.mockResolvedValue([]);
    navigationRepository.findRootDocuments.mockResolvedValue([sharedDocument] as never);
    navigationRepository.countActiveChildren.mockResolvedValue(0);
    navigationRepository.findFavoriteDocumentIds.mockResolvedValue([]);
    accessGrantRepository.findDocumentIdsWithActiveGrantsIncludingAncestors.mockResolvedValue(
      new Set(['owner-direct-shared-document']),
    );

    const useCase = new ListWorkspaceDocumentsUseCase(
      workspaceRepository,
      navigationRepository,
      new DocumentAccessResolver(),
      accessGrantRepository,
      createAccessSettingRepository(),
    );

    await expect(useCase.execute('workspace-1', currentUser, {
      limit: 50,
    })).resolves.toMatchObject({
      privateDocuments: {
        items: [],
      },
      sharedDocuments: {
        items: [
          {
            id: 'owner-direct-shared-document',
            accessScope: 'shared',
            isOwnedByCurrentUser: true,
          },
        ],
      },
    });
  });

  it('marks owner-owned workspace shared root documents as owned navigation nodes', async () => {
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.MEMBER);
    const navigationRepository = createNavigationRepository();
    const accessSettingRepository = createAccessSettingRepository();
    const sharedDocument = {
      id: 'owner-shared-document',
      publicId: 'owner-shared-document-public',
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: undefined,
      ownerUser: { id: currentUser.userId },
      title: 'Owner workspace shared plan',
      contentJson: [{ type: 'paragraph', content: [{ type: 'text', text: 'Plan' }] }],
      sortKey: 1,
    };

    navigationRepository.findTeamspaces.mockResolvedValue([]);
    navigationRepository.findRootDocuments.mockResolvedValue([sharedDocument] as never);
    navigationRepository.countActiveChildren.mockResolvedValue(0);
    navigationRepository.findFavoriteDocumentIds.mockResolvedValue([]);
    accessSettingRepository.findWorkspaceMemberPermissionsByDocumentId.mockResolvedValue(
      new Map([['owner-shared-document', DocumentAccessGrantPermission.VIEW]]),
    );

    const useCase = new ListWorkspaceDocumentsUseCase(
      workspaceRepository,
      navigationRepository,
      new DocumentAccessResolver(),
      createAccessGrantRepository(),
      accessSettingRepository,
    );

    await expect(useCase.execute('workspace-1', currentUser, {
      limit: 50,
    })).resolves.toMatchObject({
      privateDocuments: {
        items: [
          {
            id: 'owner-shared-document',
            accessScope: 'shared',
            isOwnedByCurrentUser: true,
          },
        ],
      },
    });
  });

  it('lists restricted teamspace root documents for an explicit viewer', async () => {
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.MEMBER);
    const navigationRepository = createNavigationRepository();
    const teamspace = {
      id: 'teamspace-1',
      name: 'Engineering',
      description: 'Engineering docs',
      accessMode: TeamspaceAccessMode.RESTRICTED,
    };
    const document = {
      id: 'engineering-hub',
      publicId: 'engineering-hub-public',
      workspace: { id: 'workspace-1' },
      teamspace,
      parentDocument: undefined,
      ownerUser: { id: 'another-user' },
      title: 'Engineering Hub',
      contentJson: [{ type: 'paragraph', content: [{ type: 'text', text: 'Architecture' }] }],
      sortKey: 1,
    };

    navigationRepository.findTeamspaces.mockResolvedValue([teamspace]);
    navigationRepository.findRootDocuments
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([document] as never);
    navigationRepository.findTeamspaceMemberRolesByTeamspaceId.mockResolvedValue(
      new Map([['teamspace-1', TeamspaceMemberRole.VIEWER]]),
    );
    navigationRepository.countActiveChildren.mockResolvedValue(0);
    navigationRepository.findFavoriteDocumentIds.mockResolvedValue([]);

    const useCase = new ListWorkspaceDocumentsUseCase(
      workspaceRepository,
      navigationRepository,
      new DocumentAccessResolver(),
      createAccessGrantRepository(),
      createAccessSettingRepository(),
    );

    await expect(useCase.execute('workspace-1', currentUser, {
      limit: 50,
    })).resolves.toEqual({
      privateDocuments: {
        items: [],
        nextCursor: undefined,
      },
      sharedDocuments: {
        items: [],
        nextCursor: undefined,
      },
      teamspaces: [
        {
          id: 'teamspace-1',
          name: 'Engineering',
          description: 'Engineering docs',
          documents: {
            items: [
              {
                id: 'engineering-hub',
                publicId: 'engineering-hub-public',
                accessScope: 'teamspace',
                title: 'Engineering Hub',
                teamspaceId: 'teamspace-1',
                parentDocumentId: undefined,
                sortKey: 1,
                hasChildren: false,
                hasContent: true,
                isFavorite: false,
                isOwnedByCurrentUser: false,
              },
            ],
            nextCursor: undefined,
          },
        },
      ],
    });
  });

  it('lists restricted teamspace child documents for an explicit viewer', async () => {
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.MEMBER);
    const navigationRepository = createNavigationRepository();
    const teamspace = {
      id: 'teamspace-1',
      accessMode: TeamspaceAccessMode.RESTRICTED,
    };
    const parentDocument = {
      id: 'engineering-hub',
      workspace: { id: 'workspace-1' },
      teamspace,
      ownerUser: { id: 'another-user' },
    };
    const childDocument = {
      id: 'architecture',
      publicId: 'architecture-public',
      workspace: { id: 'workspace-1' },
      teamspace,
      parentDocument: { id: 'engineering-hub' },
      ownerUser: { id: 'another-user' },
      title: 'Architecture Decisions',
      contentJson: [{ type: 'paragraph', content: [{ type: 'text', text: 'Decision log' }] }],
      sortKey: 1,
    };

    navigationRepository.findDocument.mockResolvedValue(parentDocument as never);
    navigationRepository.findChildren.mockResolvedValue([childDocument] as never);
    navigationRepository.findTeamspaceMemberRolesByTeamspaceId.mockResolvedValue(
      new Map([['teamspace-1', TeamspaceMemberRole.VIEWER]]),
    );
    navigationRepository.countActiveChildren.mockResolvedValue(0);
    navigationRepository.findFavoriteDocumentIds.mockResolvedValue([]);

    const useCase = new ListDocumentChildrenUseCase(
      workspaceRepository,
      navigationRepository,
      new DocumentAccessResolver(),
      createAccessGrantRepository(),
      createAccessSettingRepository(),
    );

    await expect(useCase.execute('engineering-hub', currentUser)).resolves.toEqual([
      {
        id: 'architecture',
        publicId: 'architecture-public',
        title: 'Architecture Decisions',
        teamspaceId: 'teamspace-1',
        parentDocumentId: 'engineering-hub',
        sortKey: 1,
        hasChildren: false,
        hasContent: true,
        isFavorite: false,
      },
    ]);
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
    const detailQueryRepository = createDocumentDetailQueryRepository();
    const visitRepository = createVisitRepository();
    const observabilityService = createObservabilityService();
    const visitPromise = new Promise<void>(() => {});
    const documentCreatedAt = new Date('2026-01-01T00:00:00.000Z');
    const documentUpdatedAt = new Date('2026-01-02T00:00:00.000Z');
    const document = createDocumentSummary({
      createdAt: documentCreatedAt,
      updatedAt: documentUpdatedAt,
      isFavorite: true,
    });

    detailQueryRepository.findDocumentDetail.mockResolvedValue(document);
    visitRepository.recordVisit.mockReturnValue(visitPromise);

    const useCase = new GetDocumentUseCase(
      detailQueryRepository,
      visitRepository,
      observabilityService,
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
      access: {
        scope: 'private',
        permission: 'manage',
        canView: true,
        canEdit: true,
        canManage: true,
        workspaceMemberPermission: undefined,
      },
      collaboration: {
        enabled: false,
        mode: 'edit',
        showPresence: false,
      },
      ownerUser: {
        id: 'user-1',
        email: currentUser.email,
        displayName: undefined,
      },
    });
    expect(visitRepository.recordVisit).toHaveBeenCalledWith({
      documentId: document.id,
      workspaceId: document.workspaceId,
      userId: currentUser.userId,
    });
    expect(detailQueryRepository.findDocumentDetail).toHaveBeenCalledWith({
      documentId: 'document-1',
      currentUser,
    });
    expect(observabilityService.recordDocumentReadDuration).toHaveBeenCalledWith(
      'total',
      expect.any(Number),
    );
  });

  it('treats an inaccessible document detail as not found', async () => {
    const detailQueryRepository = createDocumentDetailQueryRepository();
    const visitRepository = createVisitRepository();
    const observabilityService = createObservabilityService();

    detailQueryRepository.findDocumentDetail.mockResolvedValue(null);

    const useCase = new GetDocumentUseCase(
      detailQueryRepository,
      visitRepository,
      observabilityService,
    );

    await expect(useCase.execute('private-document', currentUser)).rejects.toBeInstanceOf(DocumentNotFoundError);

    expect(visitRepository.recordVisit).not.toHaveBeenCalled();
  });

  it('returns view-only collaboration mode for archived documents', async () => {
    const detailQueryRepository = createDocumentDetailQueryRepository();
    const visitRepository = createVisitRepository();
    const observabilityService = createObservabilityService();
    const archivedAt = new Date('2026-01-03T00:00:00.000Z');
    const document = createDocumentSummary({
      id: 'archived-document',
      publicId: 'archived-document-public-id',
      title: 'Archived document',
      sortKey: 1,
      archivedAt,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      collaboration: {
        enabled: false,
        mode: 'view',
        showPresence: false,
      },
    });

    detailQueryRepository.findDocumentDetail.mockResolvedValue(document);
    visitRepository.recordVisit.mockResolvedValue(undefined);

    const useCase = new GetDocumentUseCase(
      detailQueryRepository,
      visitRepository,
      observabilityService,
    );

    await expect(useCase.execute(document.id, currentUser)).resolves.toMatchObject({
      access: {
        canEdit: true,
        canManage: true,
      },
      collaboration: {
        enabled: false,
        mode: 'view',
        showPresence: false,
      },
    });
  });

  it('returns document detail from the dedicated detail query repository', async () => {
    const detailQueryRepository = createDocumentDetailQueryRepository();
    const visitRepository = createVisitRepository();
    const observabilityService = createObservabilityService();
    const document = createDocumentSummary({
      id: 'child-document',
      publicId: 'child-document-public-id',
      parentDocumentId: 'parent-document',
      title: 'Inherited document',
      sortKey: 1,
      ownerUserId: 'another-user',
      ownerUser: {
        id: 'another-user',
        email: 'another@example.com',
        displayName: undefined,
      },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      access: {
        scope: 'shared',
        permission: 'view',
        canView: true,
        canEdit: false,
        canManage: false,
      },
      collaboration: {
        enabled: true,
        mode: 'view',
        showPresence: true,
      },
    });

    detailQueryRepository.findDocumentDetail.mockResolvedValue(document);
    visitRepository.recordVisit.mockResolvedValue(undefined);

    const useCase = new GetDocumentUseCase(
      detailQueryRepository,
      visitRepository,
      observabilityService,
    );

    await expect(useCase.execute(document.id, currentUser)).resolves.toMatchObject({
      id: 'child-document',
      access: {
        scope: 'shared',
        permission: 'view',
        canView: true,
        canEdit: false,
        canManage: false,
      },
      collaboration: {
        enabled: true,
        mode: 'view',
        showPresence: true,
      },
    });
  });

  it('lists children for a workspace member under an open teamspace document', async () => {
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.MEMBER);
    const navigationRepository = createNavigationRepository();
    const teamspace = {
      id: 'teamspace-1',
      accessMode: TeamspaceAccessMode.OPEN,
    };
    const parentDocument = {
      id: 'parent-document',
      publicId: 'parent-public-id',
      workspace: { id: 'workspace-1' },
      teamspace,
      ownerUser: { id: 'another-user' },
      title: 'Engineering Hub',
      contentJson: [],
      sortKey: 1,
    };
    const childDocument = {
      id: 'child-document',
      publicId: 'child-public-id',
      workspace: { id: 'workspace-1' },
      teamspace,
      parentDocument: { id: 'parent-document' },
      ownerUser: { id: 'another-user' },
      title: 'Release Checklist',
      contentJson: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ship it' }] }],
      sortKey: 1,
    };

    navigationRepository.findDocument.mockResolvedValue(parentDocument as never);
    navigationRepository.findChildren.mockResolvedValue([childDocument] as never);
    navigationRepository.countActiveChildren.mockResolvedValue(0);
    navigationRepository.findFavoriteDocumentIds.mockResolvedValue([]);

    const useCase = new ListDocumentChildrenUseCase(
      workspaceRepository,
      navigationRepository,
      new DocumentAccessResolver(),
      createAccessGrantRepository(),
      createAccessSettingRepository(),
    );

    await expect(useCase.execute(parentDocument.id, currentUser)).resolves.toEqual([
      {
        id: 'child-document',
        publicId: 'child-public-id',
        title: 'Release Checklist',
        teamspaceId: 'teamspace-1',
        parentDocumentId: 'parent-document',
        sortKey: 1,
        hasChildren: false,
        hasContent: true,
        isFavorite: false,
      },
    ]);
    expect(navigationRepository.findChildren).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      parentDocumentId: 'parent-document',
    });
  });

  it('lists children visible through an inherited parent grant', async () => {
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.MEMBER);
    const navigationRepository = createNavigationRepository();
    const accessGrantRepository = createAccessGrantRepository();
    const parentDocument = {
      id: 'parent-document',
      publicId: 'parent-public-id',
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      ownerUser: { id: 'another-user' },
      title: 'Shared parent',
      contentJson: [],
      sortKey: 1,
    };
    const childDocument = {
      id: 'child-document',
      publicId: 'child-public-id',
      workspace: { id: 'workspace-1' },
      teamspace: undefined,
      parentDocument: { id: 'parent-document' },
      ownerUser: { id: 'another-user' },
      title: 'Inherited child',
      contentJson: [],
      sortKey: 1,
    };

    navigationRepository.findDocument.mockResolvedValue(parentDocument as never);
    navigationRepository.findChildren.mockResolvedValue([childDocument] as never);
    navigationRepository.countActiveChildren.mockResolvedValue(0);
    navigationRepository.findFavoriteDocumentIds.mockResolvedValue([]);
    accessGrantRepository.findActiveGrant.mockResolvedValue({
      id: 'parent-grant',
      documentId: 'parent-document',
      user: {
        id: currentUser.userId,
        email: currentUser.email,
      },
      permission: DocumentAccessGrantPermission.VIEW,
      grantedByUserId: 'another-user',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    accessGrantRepository.findStrongestActiveGrantPermissionsInAncestorsByDocumentId.mockResolvedValue(
      new Map([['child-document', DocumentAccessGrantPermission.VIEW]]),
    );

    const useCase = new ListDocumentChildrenUseCase(
      workspaceRepository,
      navigationRepository,
      new DocumentAccessResolver(),
      accessGrantRepository,
      createAccessSettingRepository(),
    );

    await expect(useCase.execute(parentDocument.id, currentUser)).resolves.toEqual([
      expect.objectContaining({
        id: 'child-document',
        title: 'Inherited child',
      }),
    ]);
  });
});
