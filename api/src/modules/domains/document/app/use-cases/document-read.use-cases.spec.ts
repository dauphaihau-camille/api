import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { UserStatus } from '~/modules/domains/auth/domain/enums/user-status.enum';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import type { DocumentTreeQueryRepository } from '../ports/document-tree-query.repository';
import type { DocumentVisitRepository } from '../ports/document-visit.repository';
import { GetDefaultWorkspaceDocumentUseCase } from './get-default-workspace-document.use-case';
import { ListWorkspaceDocumentsUseCase } from './list-workspace-documents.use-case';

describe('Document read use cases', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  function createWorkspaceRepository() {
    return {
      findAllForUser: jest.fn().mockResolvedValue([
        {
          id: 'workspace-1',
          version: 1,
          slug: 'workspace-1',
          name: 'Workspace 1',
          description: undefined,
          currentUserRole: WorkspaceRole.OWNER,
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

  it('passes a title search filter when listing workspace documents', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const navigationRepository = createNavigationRepository();
    navigationRepository.findTeamspaces.mockResolvedValue([]);
    navigationRepository.findRootDocuments.mockResolvedValue([]);
    navigationRepository.countActiveChildren.mockResolvedValue(0);

    const useCase = new ListWorkspaceDocumentsUseCase(workspaceRepository, navigationRepository);

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
    );

    const result = await useCase.execute('workspace-1', currentUser, 'document-recent');

    expect(navigationRepository.findDocumentByIdInWorkspace).toHaveBeenCalledWith({
      documentId: 'document-recent',
      workspaceId: 'workspace-1',
      archivedAt: null,
    });
    expect(result).toEqual({ documentId: 'document-private' });
  });
});
