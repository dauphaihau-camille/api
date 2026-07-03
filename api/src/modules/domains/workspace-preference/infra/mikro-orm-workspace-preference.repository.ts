import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CurrentUserEntity } from '../../auth/infra/persistence/entities/current-user.entity';
import { WorkspaceEntity } from '../../workspace/infra/persistence/entities/workspace.entity';
import { WorkspacePreferenceRepository } from '../app/ports/workspace-preference.repository';
import { WorkspacePreferenceEntity } from './persistence/entities/workspace-preference.entity';

@Injectable()
export class MikroOrmWorkspacePreferenceRepository implements WorkspacePreferenceRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspacePreferenceEntity | null> {
    return this.entityManager.fork().findOne(WorkspacePreferenceEntity, {
      workspace: workspaceId,
      user: userId,
    });
  }

  async save(input: {
    workspaceId: string;
    userId: string;
    expandedDocumentIds: string[];
  }): Promise<WorkspacePreferenceEntity> {
    const entityManager = this.entityManager.fork();
    const existingPreference = await entityManager.findOne(WorkspacePreferenceEntity, {
      workspace: input.workspaceId,
      user: input.userId,
    });

    if (existingPreference) {
      existingPreference.expandedDocumentIds = input.expandedDocumentIds;
      await entityManager.persist(existingPreference).flush();
      return existingPreference;
    }

    const [user, workspace] = await Promise.all([
      entityManager.findOneOrFail(CurrentUserEntity, { id: input.userId }),
      entityManager.findOneOrFail(WorkspaceEntity, { id: input.workspaceId }),
    ]);

    const preference = entityManager.create(WorkspacePreferenceEntity, {
      user,
      workspace,
      expandedDocumentIds: input.expandedDocumentIds,
    });

    await entityManager.persist(preference).flush();

    return preference;
  }
}
