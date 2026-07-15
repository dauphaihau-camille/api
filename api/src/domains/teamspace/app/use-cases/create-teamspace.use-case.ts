import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { canEditWorkspace } from '~/domains/workspace/app/workspace-permissions';
import { findWorkspaceByIdentifier } from '~/domains/workspace/app/utils/find-workspace-by-identifier.util';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import { AuditService } from '~/integrations/audit/audit.service';
import {
  TeamspacePermissionDeniedError,
  TeamspaceWorkspaceNotFoundError,
} from '../errors/teamspace-app.error';
import type { CreateTeamspaceInput, TeamspaceSummary } from '../teamspace.types';
import { TeamspaceRepository } from '../ports/teamspace.repository';
import {
  normalizeTeamspaceDescription,
  normalizeTeamspaceName,
} from '../teamspace-input';

@Injectable()
export class CreateTeamspaceUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly teamspaceRepository: TeamspaceRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    input: CreateTeamspaceInput,
  ): Promise<TeamspaceSummary> {
    const workspaces = await this.workspaceRepository.findAllForUser(currentUser.userId);
    const workspace = findWorkspaceByIdentifier(workspaces, workspaceIdentifier);

    if (!workspace) {
      throw new TeamspaceWorkspaceNotFoundError(workspaceIdentifier);
    }

    if (!canEditWorkspace(workspace.currentUserRole)) {
      throw new TeamspacePermissionDeniedError();
    }

    const teamspace = await this.teamspaceRepository.create({
      workspaceId: workspace.id,
      name: normalizeTeamspaceName(input.name),
      description: normalizeTeamspaceDescription(input.description),
    });

    await this.auditService.record({
      action: 'teamspace.created',
      resourceType: 'teamspace',
      resourceId: teamspace.id,
      metadata: {
        workspaceId: workspace.id,
        name: teamspace.name,
      },
    });

    return teamspace;
  }
}
