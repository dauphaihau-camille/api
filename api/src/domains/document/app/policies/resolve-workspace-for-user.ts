import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { findWorkspaceByIdentifier } from '~/domains/workspace/app/utils/find-workspace-by-identifier.util';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { DocumentWorkspaceNotFoundError } from '../errors/document-app.error';

export async function resolveWorkspaceForUser(
  workspaceRepository: WorkspaceRepository,
  workspaceIdentifier: string,
  currentUser: AuthenticatedUser,
) {
  const workspaces = await workspaceRepository.findAllForUser(currentUser.userId);
  const workspace = findWorkspaceByIdentifier(workspaces, workspaceIdentifier);

  if (!workspace) {
    throw new DocumentWorkspaceNotFoundError(workspaceIdentifier);
  }

  return workspace;
}
