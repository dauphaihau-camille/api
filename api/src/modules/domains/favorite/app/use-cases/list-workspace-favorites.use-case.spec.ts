import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { UserStatus } from '~/modules/domains/auth/domain/enums/user-status.enum';
import type { DocumentNavigationQueryRepository } from '~/modules/domains/document/app/ports/document-navigation-query.repository';
import type { WorkspaceRepository } from '~/modules/domains/workspace/app/ports/workspace.repository';
import { WorkspaceRole } from '~/modules/domains/workspace/domain/enums/workspace-role.enum';
import type { FavoriteRepository } from '../ports/favorite.repository';
import { ListWorkspaceFavoritesUseCase } from './list-workspace-favorites.use-case';

describe('ListWorkspaceFavoritesUseCase', () => {
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

  function createFavoriteRepository() {
    return {
      findFavoritesForWorkspace: jest.fn(),
    } as unknown as jest.Mocked<FavoriteRepository>;
  }

  function createNavigationRepository() {
    return {
      countActiveChildren: jest.fn(),
    } as unknown as jest.Mocked<DocumentNavigationQueryRepository>;
  }

  it('returns navigation metadata for favorite documents', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const favoriteRepository = createFavoriteRepository();
    const navigationRepository = createNavigationRepository();

    favoriteRepository.findFavoritesForWorkspace.mockResolvedValue([
      {
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        workspace: { id: 'workspace-1' },
        document: {
          id: 'document-1',
          publicId: 'public-1',
          teamspace: undefined,
          parentDocument: undefined,
          title: 'Parent favorite',
          sortKey: 7,
          contentJson: [
            {
              id: 'paragraph-1',
              type: 'paragraph',
              content: [{ type: 'text', text: 'Hello' }],
              children: [],
            },
          ],
        },
      },
    ] as never);
    navigationRepository.countActiveChildren.mockResolvedValue(2);

    const useCase = new ListWorkspaceFavoritesUseCase(
      favoriteRepository,
      workspaceRepository,
      navigationRepository,
    );

    await expect(
      useCase.execute('workspace-1', currentUser),
    ).resolves.toEqual([
      expect.objectContaining({
        documentId: 'document-1',
        title: 'Parent favorite',
        hasChildren: true,
        hasContent: true,
      }),
    ]);

    expect(navigationRepository.countActiveChildren).toHaveBeenCalledWith(
      'workspace-1',
      'document-1',
    );
  });
});
