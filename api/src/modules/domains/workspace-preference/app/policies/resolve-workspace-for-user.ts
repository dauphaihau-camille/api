import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { findWorkspaceByIdentifier } from '~/modules/domains/workspace/app/utils/find-workspace-by-identifier.util';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { WorkspacePreferenceWorkspaceNotFoundError } from '../errors/workspace-preference-app.error';

export async function resolveWorkspaceForUser(
  workspaceRepository: WorkspaceRepository,
  workspaceIdentifier: string,
  currentUser: AuthenticatedUser,
) {
  const workspaces = await workspaceRepository.findAllForUser(currentUser.userId);
  const workspace = findWorkspaceByIdentifier(workspaces, workspaceIdentifier);

  if (!workspace) {
    throw new WorkspacePreferenceWorkspaceNotFoundError(workspaceIdentifier);
  }

  return workspace;
}
