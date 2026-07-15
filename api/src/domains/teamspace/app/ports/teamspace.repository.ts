import type { TeamspaceSummary } from '../teamspace.types';

export class TeamspaceVersionConflictError extends Error {
  constructor() {
    super('Teamspace version conflict.');
  }
}

export abstract class TeamspaceRepository {
  abstract findAllByWorkspaceId(workspaceId: string): Promise<TeamspaceSummary[]>;

  abstract findById(teamspaceId: string): Promise<TeamspaceSummary | null>;

  abstract create(input: {
    workspaceId: string;
    name: string;
    description?: string;
  }): Promise<TeamspaceSummary>;

  abstract update(input: {
    teamspaceId: string;
    version: number;
    name?: string;
    description?: string;
  }): Promise<TeamspaceSummary | null>;
}
