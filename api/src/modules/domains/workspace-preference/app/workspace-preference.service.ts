import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { WorkspaceRepository } from '~/modules/domains/workspace/app/workspace.repository';
import { WorkspaceEntity } from '~/modules/domains/workspace/infra/persistence/entities/workspace.entity';
import type {
  UpdateWorkspacePreferenceInput,
  WorkspacePreferenceSummary,
} from './workspace-preference.types';
import { WorkspacePreferenceEntity } from '../infra/persistence/entities/workspace-preference.entity';

@Injectable()
export class WorkspacePreferenceService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  async getForWorkspace(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<WorkspacePreferenceSummary> {
    const workspace = await this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);
    const preference = await this.entityManager.fork().findOne(WorkspacePreferenceEntity, {
      workspace: workspace.id,
      user: currentUser.userId,
    });

    return {
      workspaceId: workspace.id,
      navigation: {
        expandedDocumentIds: this.normalizeExpandedDocumentIds(preference?.expandedDocumentIds),
      },
    };
  }

  async updateForWorkspace(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    input: UpdateWorkspacePreferenceInput,
  ): Promise<WorkspacePreferenceSummary> {
    const workspace = await this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);
    const entityManager = this.entityManager.fork();
    const normalizedExpandedDocumentIds = this.normalizeExpandedDocumentIds(
      input.navigation.expandedDocumentIds,
    );

    let preference = await entityManager.findOne(WorkspacePreferenceEntity, {
      workspace: workspace.id,
      user: currentUser.userId,
    });

    if (!preference) {
      const user = await entityManager.findOneOrFail(CurrentUserEntity, { id: currentUser.userId });
      const workspaceEntity = await entityManager.findOneOrFail(WorkspaceEntity, { id: workspace.id });

      preference = entityManager.create(WorkspacePreferenceEntity, {
        user,
        workspace: workspaceEntity,
        expandedDocumentIds: normalizedExpandedDocumentIds,
      });
    }
    else {
      preference.expandedDocumentIds = normalizedExpandedDocumentIds;
    }

    await entityManager.persistAndFlush(preference);

    return {
      workspaceId: workspace.id,
      navigation: {
        expandedDocumentIds: preference.expandedDocumentIds,
      },
    };
  }

  private async resolveWorkspaceForUser(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ) {
    const workspaces = await this.workspaceRepository.findAllForUser(currentUser.userId);
    const normalizedIdentifier = workspaceIdentifier.trim().toLowerCase();
    const workspace = workspaces.find((item) =>
      item.id === workspaceIdentifier || item.slug === normalizedIdentifier,
    );

    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceIdentifier} was not found.`);
    }

    return workspace;
  }

  private normalizeExpandedDocumentIds(documentIds: string[] | undefined): string[] {
    if (!documentIds) {
      return [];
    }

    return [...new Set(
      documentIds
        .map((documentId) => documentId.trim())
        .filter((documentId) => documentId.length > 0),
    )];
  }
}
