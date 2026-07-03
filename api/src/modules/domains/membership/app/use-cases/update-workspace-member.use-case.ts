import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { AuditService } from '~/modules/shared/audit/audit.service';
import {
  assertWorkspaceMemberManager,
  assertWorkspaceOwner,
} from '../../../workspace/app/workspace-permissions';
import type { WorkspaceMemberSummary } from '../../../workspace/app/contracts/workspace.contract';
import type { UpdateWorkspaceMemberInput } from '../../../workspace/app/contracts/workspace.input';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import {
  MembershipNotFoundError,
  MembershipVersionConflictError,
} from '../errors/membership-app.error';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import {
  MembershipRepository,
  MembershipRepositoryVersionConflictError,
} from '../ports/membership.repository';
import { MembershipOwnerGuardService } from '../services/membership-owner-guard.service';

@Injectable()
export class UpdateWorkspaceMemberUseCase {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly membershipOwnerGuardService: MembershipOwnerGuardService,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    workspaceIdentifier: string,
    memberId: string,
    currentUser: AuthenticatedUser,
    input: UpdateWorkspaceMemberInput,
  ): Promise<WorkspaceMemberSummary> {
    const workspace = await resolveWorkspaceForUser(
      this.membershipRepository,
      workspaceIdentifier,
      currentUser,
    );
    assertWorkspaceMemberManager(workspace.currentUserRole);

    const existingMember = await this.membershipRepository.findMemberById(workspace.id, memberId);

    if (!existingMember) {
      throw new MembershipNotFoundError();
    }

    if (
      existingMember.role === WorkspaceRole.OWNER
      || input.role === WorkspaceRole.OWNER
    ) {
      assertWorkspaceOwner(workspace.currentUserRole);
    }

    if (
      existingMember.role === WorkspaceRole.OWNER
      && input.role !== WorkspaceRole.OWNER
    ) {
      await this.membershipOwnerGuardService.assertNotLastOwner(workspace.id);
    }

    try {
      const updatedMember = await this.membershipRepository.updateMemberRole({
        workspaceId: workspace.id,
        memberId,
        version: input.version,
        role: input.role,
      });

      if (!updatedMember) {
        throw new MembershipNotFoundError();
      }

      await this.auditService.record({
        action: 'workspace.member.role_updated',
        resourceType: 'workspace_member',
        resourceId: updatedMember.id,
        metadata: {
          workspaceId: workspace.id,
          memberUserId: updatedMember.userId,
          previousRole: existingMember.role,
          nextRole: updatedMember.role,
        },
      });

      return updatedMember;
    }
    catch (error) {
      if (error instanceof MembershipRepositoryVersionConflictError) {
        throw new MembershipVersionConflictError();
      }

      throw error;
    }
  }
}
