export interface TeamspaceSummary {
  id: string;
  version: number;
  workspaceId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTeamspaceInput {
  name: string;
  description?: string;
}

export interface UpdateTeamspaceInput {
  version: number;
  name?: string;
  description?: string;
}
