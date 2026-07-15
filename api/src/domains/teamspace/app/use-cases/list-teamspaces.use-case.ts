import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { findWorkspaceByIdentifier } from '~/domains/workspace/app/utils/find-workspace-by-identifier.util';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import type { TeamspaceSummary } from '../teamspace.types';
import { TeamspaceWorkspaceNotFoundError } from '../errors/teamspace-app.error';
import { TeamspaceRepository } from '../ports/teamspace.repository';

@Injectable()
export class ListTeamspacesUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly teamspaceRepository: TeamspaceRepository,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<TeamspaceSummary[]> {
    const workspaces = await this.workspaceRepository.findAllForUser(currentUser.userId);
    const workspace = findWorkspaceByIdentifier(workspaces, workspaceIdentifier);

    if (!workspace) {
      throw new TeamspaceWorkspaceNotFoundError(workspaceIdentifier);
    }

    return this.teamspaceRepository.findAllByWorkspaceId(workspace.id);
  }
}
