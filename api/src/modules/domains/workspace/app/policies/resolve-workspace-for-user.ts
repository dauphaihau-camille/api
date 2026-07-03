import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import type { WorkspaceSummary } from '../contracts/workspace.contract';
import type { WorkspaceRepository } from '../ports/workspace.repository';

export async function resolveWorkspaceForUser(
  workspaceRepository: WorkspaceRepository,
  workspaceIdentifier: string,
  currentUser: AuthenticatedUser,
): Promise<WorkspaceSummary> {
  const workspaces = await workspaceRepository.findAllForUser(currentUser.userId);
  const normalizedIdentifier = workspaceIdentifier.trim().toLowerCase();
  const workspace = workspaces.find((item) =>
    item.id === workspaceIdentifier || item.slug === normalizedIdentifier,
  );

  if (!workspace) {
    throw new NotFoundException(`Workspace ${workspaceIdentifier} was not found.`);
  }

  return workspace;
}
