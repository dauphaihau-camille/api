import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { WorkspacePreferenceRepository } from '../ports/workspace-preference.repository';

@Injectable()
export class MarkWorkspaceAsLastActiveUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly workspacePreferenceRepository: WorkspacePreferenceRepository,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    const workspace = await resolveWorkspaceForUser(
      this.workspaceRepository,
      workspaceIdentifier,
      currentUser,
    );

    await this.workspacePreferenceRepository.markAsLastActive({
      workspaceId: workspace.id,
      userId: currentUser.userId,
    });
  }
}
