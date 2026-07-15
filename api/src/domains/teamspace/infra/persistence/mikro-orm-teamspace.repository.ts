import { LockMode, OptimisticLockError } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import {
  TeamspaceRepository,
  TeamspaceVersionConflictError,
} from '../../app/ports/teamspace.repository';
import type { TeamspaceSummary } from '../../app/teamspace.types';
import { TeamspaceEntity } from './entities/teamspace.entity';

@Injectable()
export class MikroOrmTeamspaceRepository implements TeamspaceRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findAllByWorkspaceId(workspaceId: string): Promise<TeamspaceSummary[]> {
    const teamspaces = await this.entityManager.fork().find(
      TeamspaceEntity,
      { workspace: workspaceId },
      {
        orderBy: { name: 'asc' },
      },
    );

    return teamspaces.map(toSummary);
  }

  async findById(teamspaceId: string): Promise<TeamspaceSummary | null> {
    const teamspace = await this.entityManager.fork().findOne(
      TeamspaceEntity,
      { id: teamspaceId },
      { populate: ['workspace'] },
    );

    return teamspace ? toSummary(teamspace) : null;
  }

  async create(input: {
    workspaceId: string;
    name: string;
    description?: string;
  }): Promise<TeamspaceSummary> {
    const entityManager = this.entityManager.fork();
    const teamspace = entityManager.create(TeamspaceEntity, {
      workspace: input.workspaceId,
      name: input.name,
      description: input.description,
    });

    await entityManager.persist(teamspace).flush();

    return toSummary(teamspace);
  }

  async update(input: {
    teamspaceId: string;
    version: number;
    name?: string;
    description?: string;
  }): Promise<TeamspaceSummary | null> {
    const entityManager = this.entityManager.fork();
    const teamspace = await entityManager.findOne(
      TeamspaceEntity,
      { id: input.teamspaceId },
      { populate: ['workspace'] },
    );

    if (!teamspace) {
      return null;
    }

    try {
      await entityManager.lock(teamspace, LockMode.OPTIMISTIC, input.version);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new TeamspaceVersionConflictError();
      }

      throw error;
    }

    if (input.name !== undefined) {
      teamspace.name = input.name;
    }

    if (input.description !== undefined) {
      teamspace.description = input.description;
    }

    await entityManager.persist(teamspace).flush();

    return toSummary(teamspace);
  }
}

function toSummary(teamspace: TeamspaceEntity): TeamspaceSummary {
  return {
    id: teamspace.id,
    version: teamspace.version,
    workspaceId: teamspace.workspace.id,
    name: teamspace.name,
    description: teamspace.description,
    createdAt: teamspace.createdAt,
    updatedAt: teamspace.updatedAt,
  };
}
