import type { TeamspaceSummary } from '../teamspace.types';
import type { TeamspaceAccessMode } from '../../domain/enums/teamspace-access-mode.enum';
import type { TeamspaceMemberRole } from '../../domain/enums/teamspace-member-role.enum';

export class TeamspaceVersionConflictError extends Error {
  constructor() {
    super('Teamspace version conflict.');
  }
}

export abstract class TeamspaceRepository {
  abstract findAllByWorkspaceId(workspaceId: string): Promise<TeamspaceSummary[]>;

  abstract findById(teamspaceId: string): Promise<TeamspaceSummary | null>;

  abstract findMemberRole(
    teamspaceId: string,
    userId: string,
  ): Promise<TeamspaceMemberRole | null>;

  abstract create(input: {
    workspaceId: string;
    name: string;
    description?: string;
    accessMode?: TeamspaceAccessMode;
  }): Promise<TeamspaceSummary>;

  abstract update(input: {
    teamspaceId: string;
    version: number;
    name?: string;
    description?: string;
    accessMode?: TeamspaceAccessMode;
  }): Promise<TeamspaceSummary | null>;
}
