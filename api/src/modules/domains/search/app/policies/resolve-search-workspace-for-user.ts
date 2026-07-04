import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import type { WorkspaceRepository } from '~/modules/domains/workspace/app/ports/workspace.repository';
import { findWorkspaceByIdentifier } from '~/modules/domains/workspace/app/utils/find-workspace-by-identifier.util';
import { SearchWorkspaceNotFoundError } from '../errors/search-app.error';

export async function resolveSearchWorkspaceForUser(
  workspaceRepository: WorkspaceRepository,
  workspaceIdentifier: string,
  currentUser: AuthenticatedUser,
) {
  const workspaces = await workspaceRepository.findAllForUser(currentUser.userId);
  const workspace = findWorkspaceByIdentifier(workspaces, workspaceIdentifier);

  if (!workspace) {
    throw new SearchWorkspaceNotFoundError(workspaceIdentifier);
  }

  return workspace;
}
