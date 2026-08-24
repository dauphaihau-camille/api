import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { SeatSyncService } from '~/domains/subscription/app/services/seat-sync.service';
import { AuditService } from '~/integrations/audit/audit.service';
import {
  assertWorkspaceMemberManager,
  assertWorkspaceOwner,
} from '../../../workspace/app/workspace-permissions';
import type { WorkspaceMemberSummary } from '../../../workspace/app/contracts/workspace.contract';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { MembershipNotFoundError } from '../errors/membership-app.error';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { MembershipRepository } from '../ports/membership.repository';
import { MembershipOwnerGuardService } from '../services/membership-owner-guard.service';

@Injectable()
export class RemoveWorkspaceMemberUseCase {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly membershipOwnerGuardService: MembershipOwnerGuardService,
    private readonly auditService: AuditService,
    private readonly seatSyncService: SeatSyncService,
  ) {}

  async execute(
    workspaceIdentifier: string,
    memberId: string,
    currentUser: AuthenticatedUser,
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

    if (existingMember.role === WorkspaceRole.OWNER) {
      assertWorkspaceOwner(workspace.currentUserRole);
      await this.membershipOwnerGuardService.assertNotLastOwner(workspace.id);
    }

    const removedMember = await this.membershipRepository.removeMember(workspace.id, memberId);

    if (!removedMember) {
      throw new MembershipNotFoundError();
    }

    await this.auditService.record({
      action: 'workspace.member.removed',
      resourceType: 'workspace_member',
      resourceId: removedMember.id,
      metadata: {
        workspaceId: workspace.id,
        memberUserId: removedMember.userId,
        role: removedMember.role,
      },
    });
    await this.seatSyncService.syncWorkspaceSeats(workspace.id);

    return removedMember;
  }
}
