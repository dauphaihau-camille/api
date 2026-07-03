import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { UserStatus } from '~/modules/domains/auth/domain/enums/user-status.enum';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { WorkspacePreferenceRepository } from '../ports/workspace-preference.repository';
import { GetWorkspacePreferenceUseCase } from './get-workspace-preference.use-case';
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
        expandedDocumentIds: [],
      },
    });
  });

  it('normalizes expanded document ids before saving', async () => {
    const workspaceRepository = createWorkspaceRepository();
    const workspacePreferenceRepository = createWorkspacePreferenceRepository();

    workspacePreferenceRepository.save.mockResolvedValue({
      expandedDocumentIds: ['doc-1', 'doc-2'],
    } as never);

    const useCase = new UpdateWorkspacePreferenceUseCase(
      workspaceRepository,
      workspacePreferenceRepository,
    );

    await useCase.execute('workspace-1', currentUser, {
      navigation: {
        expandedDocumentIds: [' doc-1 ', 'doc-2', 'doc-1', ''],
      },
    });

    expect(workspacePreferenceRepository.save).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      expandedDocumentIds: ['doc-1', 'doc-2'],
    });
  });
});
