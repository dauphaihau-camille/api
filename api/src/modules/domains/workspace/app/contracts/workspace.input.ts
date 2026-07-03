import type { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

export interface CreateWorkspaceInput {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateWorkspaceInput {
  version: number;
  name?: string;
  slug?: string;
  description?: string;
}

export interface AddWorkspaceMemberInput {
  email: string;
  role: WorkspaceRole;
}

export interface UpdateWorkspaceMemberInput {
  version: number;
  role: WorkspaceRole;
}
