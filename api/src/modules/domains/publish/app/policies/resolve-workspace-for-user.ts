import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { PublishWorkspaceNotFoundError } from '../errors/publish-app.error';

export async function resolveWorkspaceForUser(
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
    throw new PublishWorkspaceNotFoundError(workspaceIdentifier);
  }

  return workspace;
}
