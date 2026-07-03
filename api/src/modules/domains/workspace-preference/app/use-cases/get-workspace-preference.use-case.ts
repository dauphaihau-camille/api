import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { WorkspacePreferenceSummary } from '../workspace-preference.types';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { WorkspacePreferenceRepository } from '../ports/workspace-preference.repository';
import { normalizeExpandedDocumentIds } from '../utils/normalize-expanded-document-ids.util';

@Injectable()
export class GetWorkspacePreferenceUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly workspacePreferenceRepository: WorkspacePreferenceRepository,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<WorkspacePreferenceSummary> {
    const workspace = await resolveWorkspaceForUser(
      this.workspaceRepository,
      workspaceIdentifier,
      currentUser,
    );
    const preference = await this.workspacePreferenceRepository.findByWorkspaceAndUser(
      workspace.id,
      currentUser.userId,
    );

    return {
      workspaceId: workspace.id,
      navigation: {
        expandedDocumentIds: normalizeExpandedDocumentIds(preference?.expandedDocumentIds),
      },
    };
  }
}
