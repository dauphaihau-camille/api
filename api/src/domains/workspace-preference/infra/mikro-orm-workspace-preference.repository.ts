import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { isUniqueConstraintError } from '~/platform/database/is-unique-constraint-error';
import { CurrentUserEntity } from '../../auth/infra/persistence/entities/current-user.entity';
import { WorkspaceEntity } from '../../workspace/infra/persistence/entities/workspace.entity';
import { WorkspacePreferenceRepository } from '../app/ports/workspace-preference.repository';
import type { ExpandedDocumentIdsByScope } from '../app/workspace-preference.types';
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

  async findLastActiveForUser(userId: string): Promise<WorkspacePreferenceEntity | null> {
    return this.entityManager.fork().findOne(
      WorkspacePreferenceEntity,
      {
        user: userId,
        lastActiveAt: { $ne: null },
      },
      {
        populate: ['workspace'],
        orderBy: {
          lastActiveAt: 'desc',
        },
      },
    );
  }

  async save(input: {
    workspaceId: string;
    userId: string;
    expandedDocumentIdsByScope: ExpandedDocumentIdsByScope;
  }): Promise<WorkspacePreferenceEntity> {
    const entityManager = this.entityManager.fork();

    const preference = entityManager.create(WorkspacePreferenceEntity, {
      user: entityManager.getReference(CurrentUserEntity, input.userId),
      workspace: entityManager.getReference(WorkspaceEntity, input.workspaceId),
      expandedDocumentIdsByScope: input.expandedDocumentIdsByScope,
    });

    try {
      await entityManager.persist(preference).flush();
      return preference;
    }
    catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }

    const recoveryEntityManager = this.entityManager.fork();

    const existingPreference = await recoveryEntityManager.findOneOrFail(WorkspacePreferenceEntity, {
      workspace: input.workspaceId,
      user: input.userId,
    });

    existingPreference.expandedDocumentIdsByScope = input.expandedDocumentIdsByScope;
    await recoveryEntityManager.persist(existingPreference).flush();

    return existingPreference;
  }

  async markAsLastActive(input: {
    workspaceId: string;
    userId: string;
  }): Promise<WorkspacePreferenceEntity> {
    const entityManager = this.entityManager.fork();
    const lastActiveAt = new Date();

    const preference = entityManager.create(WorkspacePreferenceEntity, {
      user: entityManager.getReference(CurrentUserEntity, input.userId),
      workspace: entityManager.getReference(WorkspaceEntity, input.workspaceId),
      expandedDocumentIdsByScope: {},
      lastActiveAt,
    });

    try {
      await entityManager.persist(preference).flush();
      return preference;
    }
    catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }

    const recoveryEntityManager = this.entityManager.fork();
    const existingPreference = await recoveryEntityManager.findOneOrFail(WorkspacePreferenceEntity, {
      workspace: input.workspaceId,
      user: input.userId,
    });

    existingPreference.lastActiveAt = lastActiveAt;
    await recoveryEntityManager.persist(existingPreference).flush();

    return existingPreference;
  }
}
