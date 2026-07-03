import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import type { WorkspaceRepository } from '~/modules/domains/workspace/app/ports/workspace.repository';
import { FavoriteWorkspaceNotFoundError } from '../errors/favorite-app.error';

export async function resolveFavoriteWorkspaceForUser(
  workspaceRepository: WorkspaceRepository,
  workspaceIdentifier: string,
  currentUser: AuthenticatedUser,
) {
  const workspaces = await workspaceRepository.findAllForUser(currentUser.userId);
  const normalizedIdentifier = workspaceIdentifier.trim().toLowerCase();
  const workspace = workspaces.find((item) =>
    item.id === workspaceIdentifier || item.slug === normalizedIdentifier,
  );

  if (!workspace) {
    throw new FavoriteWorkspaceNotFoundError(workspaceIdentifier);
  }

  return workspace;
}
