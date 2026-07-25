import type {
  WorkspaceMemberSummary,
  WorkspaceSummary,
} from '../../../workspace/app/contracts/workspace.contract';
import type {
  AddWorkspaceMemberInput,
  UpdateWorkspaceMemberInput,
} from '../../../workspace/app/contracts/workspace.input';
import type { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';

export type MembershipUserRecord = {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
};

export class MembershipRepositoryVersionConflictError extends Error {
  constructor() {
    super('Workspace member version conflict');
  }
}

export abstract class MembershipRepository {
  abstract findAllWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]>;
  abstract findMembers(workspaceId: string): Promise<WorkspaceMemberSummary[]>;
  abstract searchMembers(input: {
    workspaceId: string;
    query?: string;
    limit: number;
  }): Promise<WorkspaceMemberSummary[]>;
  abstract findMemberById(
    workspaceId: string,
    memberId: string,
  ): Promise<WorkspaceMemberSummary | null>;
  abstract findUserByEmail(email: string): Promise<MembershipUserRecord | null>;
  abstract addMember(
    input: AddWorkspaceMemberInput & { workspaceId: string; userId: string },
  ): Promise<WorkspaceMemberSummary>;
  abstract updateMemberRole(
    input: UpdateWorkspaceMemberInput & { workspaceId: string; memberId: string },
  ): Promise<WorkspaceMemberSummary | null>;
  abstract removeMember(
    workspaceId: string,
    memberId: string,
  ): Promise<WorkspaceMemberSummary | null>;
  abstract countMembersByRole(
    workspaceId: string,
    role: WorkspaceRole,
  ): Promise<number>;
}
