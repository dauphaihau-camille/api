import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { AuditService } from '~/modules/shared/audit/audit.service';
import {
  assertWorkspaceMemberManager,
  assertWorkspaceOwner,
} from '../../../workspace/app/workspace-permissions';
import type { WorkspaceMemberSummary } from '../../../workspace/app/contracts/workspace.contract';
import type { AddWorkspaceMemberInput } from '../../../workspace/app/contracts/workspace.input';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import {
  MembershipAlreadyExistsError,
  MembershipUserNotFoundError,
} from '../errors/membership-app.error';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { MembershipRepository } from '../ports/membership.repository';

@Injectable()
export class AddWorkspaceMemberUseCase {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    input: AddWorkspaceMemberInput,
  ): Promise<WorkspaceMemberSummary> {
    const workspace = await resolveWorkspaceForUser(
      this.membershipRepository,
      workspaceIdentifier,
      currentUser,
    );
    assertWorkspaceMemberManager(workspace.currentUserRole);

    if (input.role === WorkspaceRole.OWNER) {
      assertWorkspaceOwner(workspace.currentUserRole);
    }

    const user = await this.membershipRepository.findUserByEmail(input.email);

    if (!user) {
      throw new MembershipUserNotFoundError(input.email);
    }

    const existingMembers = await this.membershipRepository.findMembers(workspace.id);

    if (existingMembers.some((member) => member.userId === user.id)) {
      throw new MembershipAlreadyExistsError();
    }

    const membership = await this.membershipRepository.addMember({
      workspaceId: workspace.id,
      userId: user.id,
      email: input.email,
      role: input.role,
    });

    await this.auditService.record({
      action: 'workspace.member.added',
      resourceType: 'workspace_member',
      resourceId: membership.id,
      metadata: {
        workspaceId: workspace.id,
        memberUserId: membership.userId,
        role: membership.role,
      },
    });

    return membership;
  }
}
