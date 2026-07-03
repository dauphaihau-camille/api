import { LockMode, OptimisticLockError } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { AuditService } from '~/modules/shared/audit/audit.service';
import {
  assertWorkspaceEditor,
} from '../../workspace/app/workspace-permissions';
import { WorkspaceRepository } from '../../workspace/app/ports/workspace.repository';
import type {
  CreateTeamspaceInput,
  TeamspaceSummary,
  UpdateTeamspaceInput,
} from './teamspace.types';
import { TeamspaceEntity } from '../infra/persistence/entities/teamspace.entity';

@Injectable()
export class TeamspaceService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly auditService: AuditService,
  ) {}

  async listForWorkspace(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<TeamspaceSummary[]> {
    const workspace = await this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);

    return this.entityManager.fork().find(TeamspaceEntity, {
      workspace: workspace.id,
    }, {
      orderBy: {
        name: 'asc',
      },
    }).then((teamspaces) => teamspaces.map((teamspace) => this.toSummary(teamspace)));
  }

  async createForWorkspace(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    input: CreateTeamspaceInput,
  ): Promise<TeamspaceSummary> {
    const workspace = await this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);
    assertWorkspaceEditor(workspace.currentUserRole);

    const name = input.name.trim();

    if (name.length < 2) {
      throw new BadRequestException('Teamspace name must be at least 2 characters.');
    }

    const entityManager = this.entityManager.fork();
    const teamspace = entityManager.create(TeamspaceEntity, {
      workspace: workspace.id,
      name,
      description: this.normalizeDescription(input.description),
    });

    await entityManager.persist(teamspace).flush();

    await this.auditService.record({
      action: 'teamspace.created',
      resourceType: 'teamspace',
      resourceId: teamspace.id,
      metadata: {
        workspaceId: workspace.id,
        name: teamspace.name,
      },
    });

    return this.toSummary(teamspace);
  }

  async updateForWorkspace(
    teamspaceId: string,
    currentUser: AuthenticatedUser,
    input: UpdateTeamspaceInput,
  ): Promise<TeamspaceSummary> {
    const entityManager = this.entityManager.fork();
    const teamspace = await entityManager.findOne(TeamspaceEntity, { id: teamspaceId }, {
      populate: ['workspace'],
    });

    if (!teamspace) {
      throw new NotFoundException(`Teamspace ${teamspaceId} was not found.`);
    }

    const workspace = await this.resolveWorkspaceForUser(teamspace.workspace.id, currentUser);
    assertWorkspaceEditor(workspace.currentUserRole);

    const nextName = input.name?.trim();

    if (input.name !== undefined && (!nextName || nextName.length < 2)) {
      throw new BadRequestException('Teamspace name must be at least 2 characters.');
    }

    try {
      await entityManager.lock(teamspace, LockMode.OPTIMISTIC, input.version);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new ConflictException('Teamspace version conflict.');
      }

      throw error;
    }

    if (nextName) {
      teamspace.name = nextName;
    }

    if (input.description !== undefined) {
      teamspace.description = this.normalizeDescription(input.description);
    }

    await entityManager.persist(teamspace).flush();

    await this.auditService.record({
      action: 'teamspace.updated',
      resourceType: 'teamspace',
      resourceId: teamspace.id,
      metadata: {
        workspaceId: workspace.id,
        name: teamspace.name,
      },
    });

    return this.toSummary(teamspace);
  }

  async getByIdForUser(
    teamspaceId: string,
    currentUser: AuthenticatedUser,
  ): Promise<TeamspaceSummary> {
    const teamspace = await this.entityManager.fork().findOne(TeamspaceEntity, { id: teamspaceId }, {
      populate: ['workspace'],
    });

    if (!teamspace) {
      throw new NotFoundException(`Teamspace ${teamspaceId} was not found.`);
    }

    await this.resolveWorkspaceForUser(teamspace.workspace.id, currentUser);

    return this.toSummary(teamspace);
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

  private toSummary(teamspace: TeamspaceEntity): TeamspaceSummary {
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

  private normalizeDescription(value?: string): string | undefined {
    const normalized = value?.trim();

    return normalized ? normalized : undefined;
  }
}
