import { LockMode, OptimisticLockError } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CurrentUserEntity } from '~/domains/auth/infra/persistence/entities/current-user.entity';
import { StorageService } from '~/integrations/storage/app/ports/storage.service';
import { resolveUserAvatarUrl } from '~/integrations/storage/app/user-avatar-url.util';
import {
  WorkspaceMemberVersionConflictError,
  WorkspaceRepository,
  WorkspaceVersionConflictError,
  type WorkspaceUserRecord,
} from '../app/ports/workspace.repository';
import type {
  WorkspaceAccess,
  WorkspaceMemberSummary,
  WorkspaceSummary,
} from '../app/contracts/workspace.contract';
import { WorkspaceRole } from '../domain/enums/workspace-role.enum';
import { WorkspaceEntity } from './persistence/entities/workspace.entity';
import { WorkspaceMemberEntity } from './persistence/entities/workspace-member.entity';

@Injectable()
export class MikroOrmWorkspaceRepository implements WorkspaceRepository {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly storageService: StorageService,
  ) {}

  async findAllForUser(userId: string): Promise<WorkspaceSummary[]> {
    const memberships = await this.entityManager.fork().find(
      WorkspaceMemberEntity,
      { user: userId },
      {
        populate: ['workspace'],
        orderBy: {
          joinedAt: 'asc',
        },
      },
    );

    return memberships.map((membership) =>
      this.toWorkspaceSummary(membership.workspace, membership.role),
    );
  }

  async findBySlug(slug: string): Promise<WorkspaceSummary | null> {
    const workspace = await this.entityManager.fork().findOne(WorkspaceEntity, { slug });

    return workspace ? this.toWorkspaceSummary(workspace, WorkspaceRole.MEMBER) : null;
  }

  async findById(workspaceId: string): Promise<WorkspaceSummary | null> {
    const workspace = await this.entityManager.fork().findOne(WorkspaceEntity, { id: workspaceId });

    return workspace ? this.toWorkspaceSummary(workspace, WorkspaceRole.MEMBER) : null;
  }

  async findWorkspaceAccess(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceAccess | null> {
    const membership = await this.entityManager.fork().findOne(
      WorkspaceMemberEntity,
      {
        workspace: workspaceId,
        user: userId,
      },
      {
        populate: ['workspace', 'user'],
      },
    );

    if (!membership) {
      return null;
    }

    return {
      workspace: this.toWorkspaceSummary(membership.workspace, membership.role),
      membership: this.toMemberSummary(membership),
    };
  }

  async createWorkspace(input: {
    ownerUserId: string;
    name: string;
    slug: string;
    description?: string;
  }): Promise<WorkspaceAccess> {
    const entityManager = this.entityManager.fork();
    const workspaceRepository = entityManager.getRepository(WorkspaceEntity);
    const membershipRepository = entityManager.getRepository(WorkspaceMemberEntity);
    const userRepository = entityManager.getRepository(CurrentUserEntity);
    const owner = await userRepository.findOneOrFail({ id: input.ownerUserId });

    const workspace = workspaceRepository.create({
      name: input.name,
      slug: input.slug,
      description: input.description,
    });

    const membership = membershipRepository.create({
      workspace,
      user: owner,
      role: WorkspaceRole.OWNER,
      joinedAt: new Date(),
    });

    await entityManager.persist([workspace, membership]).flush();

    return {
      workspace: this.toWorkspaceSummary(workspace, membership.role),
      membership: this.toMemberSummary(membership),
    };
  }

  async updateWorkspace(input: {
    workspaceId: string;
    version: number;
    name?: string;
    slug?: string;
    description?: string;
  }): Promise<WorkspaceSummary | null> {
    const entityManager = this.entityManager.fork();
    const workspaceRepository = entityManager.getRepository(WorkspaceEntity);

    try {
      const workspace = await workspaceRepository.findOne(
        { id: input.workspaceId },
        {
          lockMode: LockMode.OPTIMISTIC,
          lockVersion: input.version,
        },
      );

      if (!workspace) {
        return null;
      }

      if (input.name !== undefined) {
        workspace.name = input.name;
      }

      if (input.slug !== undefined) {
        workspace.slug = input.slug;
      }

      if (input.description !== undefined) {
        workspace.description = input.description;
      }

      await entityManager.persist(workspace).flush();

      return this.toWorkspaceSummary(workspace, WorkspaceRole.MEMBER);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new WorkspaceVersionConflictError();
      }

      throw error;
    }
  }

  async findMembers(workspaceId: string): Promise<WorkspaceMemberSummary[]> {
    const memberships = await this.entityManager.fork().find(
      WorkspaceMemberEntity,
      { workspace: workspaceId },
      {
        populate: ['user'],
        orderBy: {
          role: 'asc',
          joinedAt: 'asc',
        },
      },
    );

    return memberships.map((membership) => this.toMemberSummary(membership));
  }

  async findMemberById(
    workspaceId: string,
    memberId: string,
  ): Promise<WorkspaceMemberSummary | null> {
    const membership = await this.entityManager.fork().findOne(
      WorkspaceMemberEntity,
      {
        id: memberId,
        workspace: workspaceId,
      },
      {
        populate: ['user'],
      },
    );

    return membership ? this.toMemberSummary(membership) : null;
  }

  async findUserByEmail(email: string): Promise<WorkspaceUserRecord | null> {
    const user = await this.entityManager.fork().findOne(CurrentUserEntity, {
      email: email.toLowerCase(),
    });

    return user
      ? {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatar: resolveUserAvatarUrl(user, this.storageService),
      }
      : null;
  }

  async addMember(input: {
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
  }): Promise<WorkspaceMemberSummary> {
    const entityManager = this.entityManager.fork();
    const membershipRepository = entityManager.getRepository(WorkspaceMemberEntity);
    const userRepository = entityManager.getRepository(CurrentUserEntity);
    const workspaceRepository = entityManager.getRepository(WorkspaceEntity);
    const workspace = await workspaceRepository.findOneOrFail({ id: input.workspaceId });
    const user = await userRepository.findOneOrFail({ id: input.userId });
    const membership = membershipRepository.create({
      workspace,
      user,
      role: input.role,
      joinedAt: new Date(),
    });

    await entityManager.persist(membership).flush();
    await entityManager.populate(membership, ['user']);

    return this.toMemberSummary(membership);
  }

  async updateMemberRole(input: {
    workspaceId: string;
    memberId: string;
    version: number;
    role: WorkspaceRole;
  }): Promise<WorkspaceMemberSummary | null> {
    const entityManager = this.entityManager.fork();
    const membershipRepository = entityManager.getRepository(WorkspaceMemberEntity);

    try {
      const membership = await membershipRepository.findOne(
        {
          id: input.memberId,
          workspace: input.workspaceId,
        },
        {
          populate: ['user'],
          lockMode: LockMode.OPTIMISTIC,
          lockVersion: input.version,
        },
      );

      if (!membership) {
        return null;
      }

      membership.role = input.role;
      await entityManager.persist(membership).flush();

      return this.toMemberSummary(membership);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new WorkspaceMemberVersionConflictError();
      }

      throw error;
    }
  }

  async removeMember(
    workspaceId: string,
    memberId: string,
  ): Promise<WorkspaceMemberSummary | null> {
    const entityManager = this.entityManager.fork();
    const membershipRepository = entityManager.getRepository(WorkspaceMemberEntity);
    const membership = await membershipRepository.findOne(
      {
        id: memberId,
        workspace: workspaceId,
      },
      {
        populate: ['user'],
      },
    );

    if (!membership) {
      return null;
    }

    const summary = this.toMemberSummary(membership);
    await entityManager.remove(membership).flush();

    return summary;
  }

  async countMembersByRole(
    workspaceId: string,
    role: WorkspaceRole,
  ): Promise<number> {
    return this.entityManager.fork().count(WorkspaceMemberEntity, {
      workspace: workspaceId,
      role,
    });
  }

  private toWorkspaceSummary(
    workspace: WorkspaceEntity,
    currentUserRole: WorkspaceRole,
  ): WorkspaceSummary {
    return {
      id: workspace.id,
      version: workspace.version,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      currentUserRole,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  private toMemberSummary(membership: WorkspaceMemberEntity): WorkspaceMemberSummary {
    const avatar = resolveUserAvatarUrl(membership.user, this.storageService);

    return {
      id: membership.id,
      version: membership.version,
      userId: membership.user.id,
      email: membership.user.email,
      displayName: membership.user.displayName,
      ...(avatar ? { avatar } : {}),
      role: membership.role,
      joinedAt: membership.joinedAt,
    };
  }
}
