import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { findWorkspaceByIdentifier } from '~/modules/domains/workspace/app/utils/find-workspace-by-identifier.util';
import { MembershipWorkspaceNotFoundError } from '../errors/membership-app.error';
import type { MembershipRepository } from '../ports/membership.repository';

export async function resolveWorkspaceForUser(
  membershipRepository: MembershipRepository,
  workspaceIdentifier: string,
  currentUser: AuthenticatedUser,
) {
  const workspaces = await membershipRepository.findAllWorkspacesForUser(currentUser.userId);
  const workspace = findWorkspaceByIdentifier(workspaces, workspaceIdentifier);

  if (!workspace) {
    throw new MembershipWorkspaceNotFoundError(workspaceIdentifier);
  }

  return workspace;
}
