import { Injectable } from '@nestjs/common';
import {
  WorkspaceMemberVersionConflictError,
  WorkspaceRepository,
} from '../../workspace/app/ports/workspace.repository';
import type {
  WorkspaceMemberSummary,
  WorkspaceSummary,
} from '../../workspace/app/contracts/workspace.contract';
import type { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';
import {
  MembershipRepository,
  MembershipRepositoryVersionConflictError,
  type MembershipUserRecord,
} from '../app/ports/membership.repository';

@Injectable()
export class WorkspaceMembershipRepository implements MembershipRepository {
  constructor(private readonly workspaceRepository: WorkspaceRepository) {}

  findAllWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
    return this.workspaceRepository.findAllForUser(userId);
  }

  findMembers(workspaceId: string): Promise<WorkspaceMemberSummary[]> {
    return this.workspaceRepository.findMembers(workspaceId);
  }

  searchMembers(input: {
    workspaceId: string;
    query?: string;
    limit: number;
  }): Promise<WorkspaceMemberSummary[]> {
    return this.workspaceRepository.searchMembers(input);
  }

  findMemberById(
    workspaceId: string,
    memberId: string,
  ): Promise<WorkspaceMemberSummary | null> {
    return this.workspaceRepository.findMemberById(workspaceId, memberId);
  }

  findUserByEmail(email: string): Promise<MembershipUserRecord | null> {
    return this.workspaceRepository.findUserByEmail(email);
  }

  addMember(input: {
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
  }): Promise<WorkspaceMemberSummary> {
    return this.workspaceRepository.addMember(input);
  }

  async updateMemberRole(input: {
    workspaceId: string;
    memberId: string;
    version: number;
    role: WorkspaceRole;
  }): Promise<WorkspaceMemberSummary | null> {
    try {
      return await this.workspaceRepository.updateMemberRole(input);
    }
    catch (error) {
      if (error instanceof WorkspaceMemberVersionConflictError) {
        throw new MembershipRepositoryVersionConflictError();
      }

      throw error;
    }
  }

  removeMember(
    workspaceId: string,
    memberId: string,
  ): Promise<WorkspaceMemberSummary | null> {
    return this.workspaceRepository.removeMember(workspaceId, memberId);
  }

  countMembersByRole(
    workspaceId: string,
    role: WorkspaceRole,
  ): Promise<number> {
    return this.workspaceRepository.countMembersByRole(workspaceId, role);
  }
}
