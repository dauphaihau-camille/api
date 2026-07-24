import type { WorkspaceRole } from '../../domain/enums/workspace-role.enum';
import type {
  WorkspaceAccess,
  WorkspaceMemberSummary,
  WorkspaceSummary,
} from '../contracts/workspace.contract';

export type WorkspaceUserRecord = {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
};

export class WorkspaceVersionConflictError extends Error {
  constructor() {
    super('Workspace version conflict');
  }
}

export class WorkspaceMemberVersionConflictError extends Error {
  constructor() {
    super('Workspace member version conflict');
  }
}

export abstract class WorkspaceRepository {
  abstract findAllForUser(userId: string): Promise<WorkspaceSummary[]>;

  abstract findBySlug(slug: string): Promise<WorkspaceSummary | null>;

  abstract findById(workspaceId: string): Promise<WorkspaceSummary | null>;

  abstract findWorkspaceAccess(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceAccess | null>;

  abstract createWorkspace(input: {
    ownerUserId: string;
    name: string;
    slug: string;
    description?: string;
  }): Promise<WorkspaceAccess>;

  abstract updateWorkspace(input: {
    workspaceId: string;
    version: number;
    name?: string;
    slug?: string;
    description?: string;
  }): Promise<WorkspaceSummary | null>;

  abstract findMembers(workspaceId: string): Promise<WorkspaceMemberSummary[]>;

  abstract findMemberById(
    workspaceId: string,
    memberId: string,
  ): Promise<WorkspaceMemberSummary | null>;

  abstract findUserByEmail(email: string): Promise<WorkspaceUserRecord | null>;

  abstract addMember(input: {
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
  }): Promise<WorkspaceMemberSummary>;

  abstract updateMemberRole(input: {
    workspaceId: string;
    memberId: string;
    version: number;
    role: WorkspaceRole;
  }): Promise<WorkspaceMemberSummary | null>;

  abstract removeMember(
    workspaceId: string,
    memberId: string,
  ): Promise<WorkspaceMemberSummary | null>;

  abstract countMembersByRole(
    workspaceId: string,
    role: WorkspaceRole,
  ): Promise<number>;
}
