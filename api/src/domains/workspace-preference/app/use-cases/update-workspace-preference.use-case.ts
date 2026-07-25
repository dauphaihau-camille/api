import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type {
  UpdateWorkspacePreferenceInput,
  WorkspacePreferenceSummary,
} from '../workspace-preference.types';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { WorkspacePreferenceRepository } from '../ports/workspace-preference.repository';
import { normalizeExpandedDocumentIdsByScope } from '../utils/normalize-expanded-document-ids.util';

@Injectable()
export class UpdateWorkspacePreferenceUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly workspacePreferenceRepository: WorkspacePreferenceRepository,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    input: UpdateWorkspacePreferenceInput,
  ): Promise<WorkspacePreferenceSummary> {
    const workspace = await resolveWorkspaceForUser(
      this.workspaceRepository,
      workspaceIdentifier,
      currentUser,
    );

    const expandedDocumentIdsByScope = normalizeExpandedDocumentIdsByScope(
      input.navigation.expandedDocumentIdsByScope,
    );

    const preference = await this.workspacePreferenceRepository.save({
      workspaceId: workspace.id,
      userId: currentUser.userId,
      expandedDocumentIdsByScope,
    });

    return {
      workspaceId: workspace.id,
      navigation: {
        expandedDocumentIdsByScope: preference.expandedDocumentIdsByScope,
      },
      activity: {
        lastActiveAt: preference.lastActiveAt,
      },
    };
  }
}
