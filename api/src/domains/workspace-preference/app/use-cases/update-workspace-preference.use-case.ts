import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type {
  UpdateWorkspacePreferenceInput,
  WorkspacePreferenceSummary,
} from '../workspace-preference.types';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { WorkspacePreferenceRepository } from '../ports/workspace-preference.repository';
import { normalizeExpandedDocumentIds } from '../utils/normalize-expanded-document-ids.util';

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
    const expandedDocumentIds = normalizeExpandedDocumentIds(
      input.navigation.expandedDocumentIds,
    );
    const preference = await this.workspacePreferenceRepository.save({
      workspaceId: workspace.id,
      userId: currentUser.userId,
      expandedDocumentIds,
    });

    return {
      workspaceId: workspace.id,
      navigation: {
        expandedDocumentIds: preference.expandedDocumentIds,
      },
      activity: {
        lastActiveAt: preference.lastActiveAt,
      },
    };
  }
}
