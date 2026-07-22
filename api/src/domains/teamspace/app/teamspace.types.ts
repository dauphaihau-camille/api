import type { TeamspaceAccessMode } from '../domain/enums/teamspace-access-mode.enum';

export interface TeamspaceSummary {
  id: string;
  version: number;
  workspaceId: string;
  name: string;
  description?: string;
  accessMode: TeamspaceAccessMode;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTeamspaceInput {
  name: string;
  description?: string;
  accessMode?: TeamspaceAccessMode;
}

export interface UpdateTeamspaceInput {
  version: number;
  name?: string;
  description?: string;
  accessMode?: TeamspaceAccessMode;
}
