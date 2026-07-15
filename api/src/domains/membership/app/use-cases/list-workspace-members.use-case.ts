import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import type { WorkspaceMemberSummary } from '../../../workspace/app/contracts/workspace.contract';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { MembershipRepository } from '../ports/membership.repository';

@Injectable()
export class ListWorkspaceMembersUseCase {
  constructor(private readonly membershipRepository: MembershipRepository) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<WorkspaceMemberSummary[]> {
    const workspace = await resolveWorkspaceForUser(
      this.membershipRepository,
      workspaceIdentifier,
      currentUser,
    );

    return this.membershipRepository.findMembers(workspace.id);
  }
}
