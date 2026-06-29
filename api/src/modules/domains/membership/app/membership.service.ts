import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { AuditService } from '~/modules/shared/audit/audit.service';
import {
  assertWorkspaceMemberManager,
  assertWorkspaceOwner,
} from '../../workspace/app/workspace-permissions';
import {
  WorkspaceMemberVersionConflictError,
  WorkspaceRepository,
} from '../../workspace/app/workspace.repository';
import type {
  AddWorkspaceMemberInput,
  UpdateWorkspaceMemberInput,
  WorkspaceMemberSummary,
} from '../../workspace/app/workspace.types';
import { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';

@Injectable()
export class MembershipService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly auditService: AuditService,
  ) {}

  async listForWorkspace(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<WorkspaceMemberSummary[]> {
    const workspace = await this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);

    return this.workspaceRepository.findMembers(workspace.id);
  }

  async addToWorkspace(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    input: AddWorkspaceMemberInput,
  ): Promise<WorkspaceMemberSummary> {
    const workspace = await this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);
    assertWorkspaceMemberManager(workspace.currentUserRole);

    if (input.role === WorkspaceRole.OWNER) {
      assertWorkspaceOwner(workspace.currentUserRole);
    }

    const user = await this.workspaceRepository.findUserByEmail(input.email);

    if (!user) {
      throw new NotFoundException(`User ${input.email} was not found.`);
    }

    const existingMembers = await this.workspaceRepository.findMembers(workspace.id);

    if (existingMembers.some((member) => member.userId === user.id)) {
      throw new ConflictException('That user is already a workspace member.');
    }

    const membership = await this.workspaceRepository.addMember({
      workspaceId: workspace.id,
      userId: user.id,
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

  async updateWorkspaceMember(
    workspaceIdentifier: string,
    memberId: string,
    currentUser: AuthenticatedUser,
    input: UpdateWorkspaceMemberInput,
  ): Promise<WorkspaceMemberSummary> {
    const workspace = await this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);
    assertWorkspaceMemberManager(workspace.currentUserRole);

    const existingMember = await this.workspaceRepository.findMemberById(workspace.id, memberId);

    if (!existingMember) {
      throw new NotFoundException('Workspace member was not found.');
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
      await this.assertNotLastOwner(workspace.id);
    }

    try {
      const updatedMember = await this.workspaceRepository.updateMemberRole({
        workspaceId: workspace.id,
        memberId,
        version: input.version,
        role: input.role,
      });

      if (!updatedMember) {
        throw new NotFoundException('Workspace member was not found.');
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
      if (error instanceof WorkspaceMemberVersionConflictError) {
        throw new ConflictException('Workspace member version conflict.');
      }

      throw error;
    }
  }

  async removeFromWorkspace(
    workspaceIdentifier: string,
    memberId: string,
    currentUser: AuthenticatedUser,
  ): Promise<WorkspaceMemberSummary> {
    const workspace = await this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);
    assertWorkspaceMemberManager(workspace.currentUserRole);

    const existingMember = await this.workspaceRepository.findMemberById(workspace.id, memberId);

    if (!existingMember) {
      throw new NotFoundException('Workspace member was not found.');
    }

    if (existingMember.role === WorkspaceRole.OWNER) {
      assertWorkspaceOwner(workspace.currentUserRole);
      await this.assertNotLastOwner(workspace.id);
    }

    const removedMember = await this.workspaceRepository.removeMember(workspace.id, memberId);

    if (!removedMember) {
      throw new NotFoundException('Workspace member was not found.');
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

    return removedMember;
  }

  private async assertNotLastOwner(workspaceId: string): Promise<void> {
    const ownerCount = await this.workspaceRepository.countMembersByRole(
      workspaceId,
      WorkspaceRole.OWNER,
    );

    if (ownerCount <= 1) {
      throw new ConflictException('Workspace must keep at least one owner.');
    }
  }

  private async resolveWorkspaceForUser(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ) {
    const workspaces = await this.workspaceRepository.findAllForUser(currentUser.userId);
    const normalizedIdentifier = workspaceIdentifier.trim().toLowerCase();
    const workspace = workspaces.find((item) =>
      item.id === workspaceIdentifier || item.slug === normalizedIdentifier,
    );

    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceIdentifier} was not found.`);
    }

    return workspace;
  }
}
