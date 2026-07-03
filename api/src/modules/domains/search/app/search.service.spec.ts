import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { UserStatus } from '~/modules/domains/auth/domain/enums/user-status.enum';
import { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';
import type { WorkspaceRepository } from '../../workspace/app/ports/workspace.repository';
import { SearchWorkspaceDocumentsUseCase } from './use-cases/search-workspace-documents.use-case';
import type { SearchRepository } from './ports/search.repository';

describe('SearchWorkspaceDocumentsUseCase', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  function createService() {
    const searchRepository = {
      findRecentVisitedDocuments: jest.fn(),
      findMatchedDocuments: jest.fn(),
      findAncestorTitles: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<SearchRepository>;
    const workspaceRepository = {
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

    return {
      service: new SearchWorkspaceDocumentsUseCase(searchRepository, workspaceRepository),
      searchRepository,
      workspaceRepository,
    };
  }

  it('uses the repository for recent visits when query is empty', async () => {
    const { service, searchRepository, workspaceRepository } = createService();
    const updatedAt = new Date('2026-02-01T00:00:00.000Z');
    const visitedAt = new Date('2026-02-02T00:00:00.000Z');

    searchRepository.findRecentVisitedDocuments.mockResolvedValue([
      {
        document: {
          id: 'document-1',
          publicId: 'public-1',
          workspace: { id: 'workspace-1' },
          teamspace: { id: 'teamspace-1', name: 'Engineering' },
          parentDocument: { id: 'parent-1' },
          title: 'Doc 1',
          contentJson: [{ type: 'paragraph', content: [] }],
          updatedBy: { displayName: 'User 1', email: 'user1@example.com' },
          updatedAt,
        },
        visitedAt,
      },
    ] as never);
    searchRepository.findAncestorTitles.mockResolvedValue(['Parent']);

    const result = await service.execute('workspace-1', currentUser);

    expect(workspaceRepository.findAllForUser).toHaveBeenCalledWith(currentUser.userId);
    expect(searchRepository.findRecentVisitedDocuments).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      limit: 20,
    });
    expect(searchRepository.findMatchedDocuments).not.toHaveBeenCalled();
    expect(searchRepository.findAncestorTitles).toHaveBeenCalledWith('parent-1');
    expect(result).toEqual([
      {
        documentId: 'document-1',
        publicId: 'public-1',
        workspaceId: 'workspace-1',
        teamspaceId: 'teamspace-1',
        parentDocumentId: 'parent-1',
        title: 'Doc 1',
        hasContent: false,
        breadcrumbPath: ['Engineering', 'Parent'],
        updatedByName: 'User 1',
        matchedText: undefined,
        updatedAt,
        visitedAt,
      },
    ]);
  });

  it('uses the repository for matched documents when query is present', async () => {
    const { service, searchRepository } = createService();
    const updatedAt = new Date('2026-03-01T00:00:00.000Z');

    searchRepository.findMatchedDocuments.mockResolvedValue([
      {
        document: {
          id: 'document-2',
          publicId: 'public-2',
          workspace: { id: 'workspace-1' },
          teamspace: undefined,
          parentDocument: undefined,
          title: 'Doc 2',
          contentJson: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
          updatedBy: { displayName: undefined, email: 'user2@example.com' },
          updatedAt,
        },
        matchedText: 'Hello world',
      },
    ] as never);

    const result = await service.execute('workspace-1', currentUser, '  hello  ', 5);

    expect(searchRepository.findMatchedDocuments).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      query: 'hello',
      limit: 5,
    });
    expect(searchRepository.findRecentVisitedDocuments).not.toHaveBeenCalled();
    expect(searchRepository.findAncestorTitles).toHaveBeenCalledWith(undefined);
    expect(result).toEqual([
      {
        documentId: 'document-2',
        publicId: 'public-2',
        workspaceId: 'workspace-1',
        teamspaceId: undefined,
        parentDocumentId: undefined,
        title: 'Doc 2',
        hasContent: true,
        breadcrumbPath: [],
        updatedByName: 'user2@example.com',
        matchedText: 'Hello world',
        updatedAt,
        visitedAt: undefined,
      },
    ]);
  });
});
