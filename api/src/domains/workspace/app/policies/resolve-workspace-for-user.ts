import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import type { WorkspaceSummary } from '../contracts/workspace.contract';
import type { WorkspaceRepository } from '../ports/workspace.repository';
import { findWorkspaceByIdentifier } from '../utils/find-workspace-by-identifier.util';

export async function resolveWorkspaceForUser(
  workspaceRepository: WorkspaceRepository,
  workspaceIdentifier: string,
  currentUser: AuthenticatedUser,
): Promise<WorkspaceSummary> {
  const workspaces = await workspaceRepository.findAllForUser(currentUser.userId);
  const workspace = findWorkspaceByIdentifier(workspaces, workspaceIdentifier);

  if (!workspace) {
    throw new NotFoundException(`Workspace ${workspaceIdentifier} was not found.`);
  }

  return workspace;
}
