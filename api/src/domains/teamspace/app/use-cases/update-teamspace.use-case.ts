import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { canEditWorkspace } from '~/domains/workspace/app/workspace-permissions';
import { findWorkspaceByIdentifier } from '~/domains/workspace/app/utils/find-workspace-by-identifier.util';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import { AuditService } from '~/integrations/audit/audit.service';
import type { TeamspaceSummary, UpdateTeamspaceInput } from '../teamspace.types';
import {
  TeamspaceRepository,
  TeamspaceVersionConflictError as TeamspaceRepositoryVersionConflictError,
} from '../ports/teamspace.repository';
import {
  TeamspaceNotFoundError,
  TeamspacePermissionDeniedError,
  TeamspaceVersionConflictError,
  TeamspaceWorkspaceNotFoundError,
} from '../errors/teamspace-app.error';
import {
  normalizeTeamspaceDescription,
  normalizeTeamspaceName,
} from '../teamspace-input';

@Injectable()
export class UpdateTeamspaceUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly teamspaceRepository: TeamspaceRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    teamspaceId: string,
    currentUser: AuthenticatedUser,
    input: UpdateTeamspaceInput,
  ): Promise<TeamspaceSummary> {
    const existingTeamspace = await this.teamspaceRepository.findById(teamspaceId);

    if (!existingTeamspace) {
      throw new TeamspaceNotFoundError(teamspaceId);
    }

    const workspaces = await this.workspaceRepository.findAllForUser(currentUser.userId);
    const workspace = findWorkspaceByIdentifier(workspaces, existingTeamspace.workspaceId);

    if (!workspace) {
      throw new TeamspaceWorkspaceNotFoundError(existingTeamspace.workspaceId);
    }

    if (!canEditWorkspace(workspace.currentUserRole)) {
      throw new TeamspacePermissionDeniedError();
    }

    try {
      const teamspace = await this.teamspaceRepository.update({
        teamspaceId,
        version: input.version,
        name: input.name === undefined
          ? undefined
          : normalizeTeamspaceName(input.name),
        description: input.description === undefined
          ? undefined
          : normalizeTeamspaceDescription(input.description),
      });

      if (!teamspace) {
        throw new TeamspaceNotFoundError(teamspaceId);
      }

      await this.auditService.record({
        action: 'teamspace.updated',
        resourceType: 'teamspace',
        resourceId: teamspace.id,
        metadata: {
          workspaceId: workspace.id,
          name: teamspace.name,
        },
      });

      return teamspace;
    }
    catch (error) {
      if (error instanceof TeamspaceRepositoryVersionConflictError) {
        throw new TeamspaceVersionConflictError();
      }

      throw error;
    }
  }
}
