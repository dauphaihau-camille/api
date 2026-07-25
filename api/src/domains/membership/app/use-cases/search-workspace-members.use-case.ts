import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { MembershipRepository } from '../ports/membership.repository';
import type { WorkspaceMemberSummary } from '~/domains/workspace/app/contracts/workspace.contract';

@Injectable()
export class SearchWorkspaceMembersUseCase {
  constructor(private readonly membershipRepository: MembershipRepository) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    query?: string,
    limit = 5,
  ): Promise<WorkspaceMemberSummary[]> {
    const workspace = await resolveWorkspaceForUser(
      this.membershipRepository,
      workspaceIdentifier,
      currentUser,
    );

    return this.membershipRepository.searchMembers({
      workspaceId: workspace.id,
      query,
      limit,
    });
  }
}
