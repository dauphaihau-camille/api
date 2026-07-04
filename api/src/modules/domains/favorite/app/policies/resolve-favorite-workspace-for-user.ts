import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import type { WorkspaceRepository } from '~/modules/domains/workspace/app/ports/workspace.repository';
import { findWorkspaceByIdentifier } from '~/modules/domains/workspace/app/utils/find-workspace-by-identifier.util';
import { FavoriteWorkspaceNotFoundError } from '../errors/favorite-app.error';

export async function resolveFavoriteWorkspaceForUser(
  workspaceRepository: WorkspaceRepository,
  workspaceIdentifier: string,
  currentUser: AuthenticatedUser,
) {
  const workspaces = await workspaceRepository.findAllForUser(currentUser.userId);
  const workspace = findWorkspaceByIdentifier(workspaces, workspaceIdentifier);

  if (!workspace) {
    throw new FavoriteWorkspaceNotFoundError(workspaceIdentifier);
  }

  return workspace;
}
