import type { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

export interface WorkspaceSummary {
  id: string;
  version: number;
  name: string;
  slug: string;
  description?: string;
  currentUserRole: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMemberSummary {
  id: string;
  version: number;
  userId: string;
  email: string;
  displayName?: string;
  avatar?: string;
  role: WorkspaceRole;
  joinedAt: Date;
}

export interface WorkspaceAccess {
  workspace: WorkspaceSummary;
  membership: WorkspaceMemberSummary;
}
