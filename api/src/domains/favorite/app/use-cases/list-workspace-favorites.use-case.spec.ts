import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import type { DocumentNavigationQueryRepository } from '~/domains/document/app/ports/document-navigation-query.repository';
import { DocumentAccessResolver } from '~/domains/document/app/policies/document-access.resolver';
import { TeamspaceAccessMode } from '~/domains/teamspace/domain/enums/teamspace-access-mode.enum';
import { TeamspaceMemberRole } from '~/domains/teamspace/domain/enums/teamspace-member-role.enum';
import type { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import { WorkspaceRole } from '~/domains/workspace/domain/enums/workspace-role.enum';
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
      findTeamspaceMemberRolesForUser: jest.fn().mockResolvedValue(new Map()),
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
          ownerUser: { id: 'user-1' },
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
      new DocumentAccessResolver(),
    );

    await expect(
      useCase.execute('workspace-1', currentUser),
    ).resolves.toEqual([
      expect.objectContaining({
        documentId: 'document-1',
        title: 'Parent favorite',
        hasChildren: true,
        hasContent: true,
        access: {
          permission: 'manage',
          canView: true,
          canEdit: true,
          canManage: true,
        },
      }),
    ]);

    expect(navigationRepository.countActiveChildren).toHaveBeenCalledWith(
      'workspace-1',
      'document-1',
    );
  });

  it('returns read-only access for open teamspace favorites visible to workspace members', async () => {
    const workspaceRepository = createWorkspaceRepository();
    workspaceRepository.findAllForUser.mockResolvedValue([
      {
        id: 'workspace-1',
        version: 1,
        slug: 'workspace-1',
        name: 'Workspace 1',
        description: undefined,
        currentUserRole: WorkspaceRole.MEMBER,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    const favoriteRepository = createFavoriteRepository();
    const navigationRepository = createNavigationRepository();

    favoriteRepository.findFavoritesForWorkspace.mockResolvedValue([
      {
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        workspace: { id: 'workspace-1' },
        document: {
          id: 'document-1',
          publicId: 'public-1',
          teamspace: {
            id: 'teamspace-1',
            accessMode: TeamspaceAccessMode.OPEN,
          },
          parentDocument: undefined,
          title: 'Teamspace favorite',
          sortKey: 7,
          ownerUser: { id: 'another-user' },
          contentJson: [],
        },
      },
    ] as never);
    navigationRepository.countActiveChildren.mockResolvedValue(0);

    const useCase = new ListWorkspaceFavoritesUseCase(
      favoriteRepository,
      workspaceRepository,
      navigationRepository,
      new DocumentAccessResolver(),
    );

    await expect(
      useCase.execute('workspace-1', currentUser),
    ).resolves.toEqual([
      expect.objectContaining({
        documentId: 'document-1',
        access: {
          permission: 'view',
          canView: true,
          canEdit: false,
          canManage: false,
        },
      }),
    ]);
  });

  it('returns edit access for restricted teamspace editor favorites', async () => {
    const workspaceRepository = createWorkspaceRepository();
    workspaceRepository.findAllForUser.mockResolvedValue([
      {
        id: 'workspace-1',
        version: 1,
        slug: 'workspace-1',
        name: 'Workspace 1',
        description: undefined,
        currentUserRole: WorkspaceRole.MEMBER,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    const favoriteRepository = createFavoriteRepository();
    const navigationRepository = createNavigationRepository();

    favoriteRepository.findTeamspaceMemberRolesForUser.mockResolvedValue(new Map([
      ['teamspace-1', TeamspaceMemberRole.EDITOR],
    ]));
    favoriteRepository.findFavoritesForWorkspace.mockResolvedValue([
      {
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        workspace: { id: 'workspace-1' },
        document: {
          id: 'document-1',
          publicId: 'public-1',
          teamspace: {
            id: 'teamspace-1',
            accessMode: TeamspaceAccessMode.RESTRICTED,
          },
          parentDocument: undefined,
          title: 'Teamspace favorite',
          sortKey: 7,
          ownerUser: { id: 'another-user' },
          contentJson: [],
        },
      },
    ] as never);
    navigationRepository.countActiveChildren.mockResolvedValue(0);

    const useCase = new ListWorkspaceFavoritesUseCase(
      favoriteRepository,
      workspaceRepository,
      navigationRepository,
      new DocumentAccessResolver(),
    );

    await expect(
      useCase.execute('workspace-1', currentUser),
    ).resolves.toEqual([
      expect.objectContaining({
        documentId: 'document-1',
        access: {
          permission: 'edit',
          canView: true,
          canEdit: true,
          canManage: false,
        },
      }),
    ]);

    expect(favoriteRepository.findTeamspaceMemberRolesForUser).toHaveBeenCalledWith({
      teamspaceIds: ['teamspace-1'],
      userId: 'user-1',
    });
  });
});
