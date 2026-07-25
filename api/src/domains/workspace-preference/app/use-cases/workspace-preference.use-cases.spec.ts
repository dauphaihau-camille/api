import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { WorkspacePreferenceRepository } from '../ports/workspace-preference.repository';
import { GetWorkspacePreferenceUseCase } from './get-workspace-preference.use-case';
import { GetLastActiveWorkspaceUseCase } from './get-last-active-workspace.use-case';
import { MarkWorkspaceAsLastActiveUseCase } from './mark-workspace-as-last-active.use-case';
import { UpdateWorkspacePreferenceUseCase } from './update-workspace-preference.use-case';

describe('Workspace preference use cases', () => {
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

  function createWorkspacePreferenceRepository() {
    return {
      findByWorkspaceAndUser: jest.fn(),
      findLastActiveForUser: jest.fn(),
      markAsLastActive: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<WorkspacePreferenceRepository>;
  }

  it('returns an empty navigation state when no preference exists', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const workspacePreferenceRepository = createWorkspacePreferenceRepository();

    workspacePreferenceRepository.findByWorkspaceAndUser.mockResolvedValue(null);

    const useCase = new GetWorkspacePreferenceUseCase(
      workspaceRepository,
      workspacePreferenceRepository,
    );

    await expect(useCase.execute('workspace-1', currentUser)).resolves.toEqual({
      workspaceId: 'workspace-1',
      navigation: {
        expandedDocumentIdsByScope: {},
      },
      activity: {
        lastActiveAt: null,
      },
    });
  });

  it('normalizes expanded document ids before saving', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const workspacePreferenceRepository = createWorkspacePreferenceRepository();

    workspacePreferenceRepository.save.mockResolvedValue({
      expandedDocumentIdsByScope: {
        private: ['doc-1', 'doc-2'],
      },
    } as never);

    const useCase = new UpdateWorkspacePreferenceUseCase(
      workspaceRepository,
      workspacePreferenceRepository,
    );

    await useCase.execute('workspace-1', currentUser, {
      navigation: {
        expandedDocumentIdsByScope: {
          private: [' doc-1 ', 'doc-2', 'doc-1', ''],
          ' ': ['ignored-doc'],
          favorites: [' fav-1 '],
        },
      },
    });

    expect(workspacePreferenceRepository.save).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      expandedDocumentIdsByScope: {
        private: ['doc-1', 'doc-2'],
        favorites: ['fav-1'],
      },
    });
  });

  it('returns the last active workspace when it is still accessible to the user', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const workspacePreferenceRepository = createWorkspacePreferenceRepository();

    workspacePreferenceRepository.findLastActiveForUser.mockResolvedValue({
      workspace: { id: 'workspace-1' },
    } as never);

    const useCase = new GetLastActiveWorkspaceUseCase(
      workspaceRepository,
      workspacePreferenceRepository,
    );

    await expect(useCase.execute(currentUser)).resolves.toEqual({
      id: 'workspace-1',
      version: 1,
      slug: 'workspace-1',
      name: 'Workspace 1',
      description: undefined,
      currentUserRole: WorkspaceRole.OWNER,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  it('marks a workspace as last active after resolving access', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const workspacePreferenceRepository = createWorkspacePreferenceRepository();
    const useCase = new MarkWorkspaceAsLastActiveUseCase(
      workspaceRepository,
      workspacePreferenceRepository,
    );

    await useCase.execute('workspace-1', currentUser);

    expect(workspacePreferenceRepository.markAsLastActive).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });
  });
});
