import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import type { WorkspaceSummary } from '../../../workspace/app/contracts/workspace.contract';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { WorkspacePreferenceRepository } from '../ports/workspace-preference.repository';

@Injectable()
export class GetLastActiveWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly workspacePreferenceRepository: WorkspacePreferenceRepository,
  ) {}

  async execute(currentUser: AuthenticatedUser): Promise<WorkspaceSummary | null> {
    const [workspaces, lastActivePreference] = await Promise.all([
      this.workspaceRepository.findAllForUser(currentUser.userId),
      this.workspacePreferenceRepository.findLastActiveForUser(currentUser.userId),
    ]);

    if (!lastActivePreference) {
      return null;
    }

    return workspaces.find((workspace) => workspace.id === lastActivePreference.workspace.id) ?? null;
  }
}
