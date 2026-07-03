import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { MembershipWorkspaceNotFoundError } from '../errors/membership-app.error';
import type { MembershipRepository } from '../ports/membership.repository';

export async function resolveWorkspaceForUser(
  membershipRepository: MembershipRepository,
  workspaceIdentifier: string,
  currentUser: AuthenticatedUser,
) {
  const workspaces = await membershipRepository.findAllWorkspacesForUser(currentUser.userId);
  const normalizedIdentifier = workspaceIdentifier.trim().toLowerCase();
  const workspace = workspaces.find((item) =>
    item.id === workspaceIdentifier || item.slug === normalizedIdentifier,
  );

  if (!workspace) {
    throw new MembershipWorkspaceNotFoundError(workspaceIdentifier);
  }

  return workspace;
}
