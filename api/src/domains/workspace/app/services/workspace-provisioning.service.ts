import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { CurrentUserEntity } from '~/domains/auth/infra/persistence/entities/current-user.entity';
import { AuditService } from '~/integrations/audit/audit.service';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';
import { WorkspaceMemberEntity } from '../../infra/persistence/entities/workspace-member.entity';
import { WorkspaceEntity } from '../../infra/persistence/entities/workspace.entity';
import type { WorkspaceSummary } from '../contracts/workspace.contract';
import { WorkspaceDefaultDocumentProvisioner } from '../ports/workspace-default-document-provisioner';

@Injectable()
export class WorkspaceProvisioningService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly auditService: AuditService,
    private readonly workspaceDefaultDocumentProvisioner: WorkspaceDefaultDocumentProvisioner,
  ) {}

  async createWorkspaceWithDefaults(
    currentUser: AuthenticatedUser,
    input: {
      name: string;
      slug: string;
      description?: string;
    },
  ): Promise<WorkspaceSummary> {
    const { workspace } = await this.entityManager.transactional(async (entityManager) => {
      const owner = await entityManager.findOneOrFail(CurrentUserEntity, { id: currentUser.userId });
      const createdWorkspace = entityManager.create(WorkspaceEntity, {
        name: input.name,
        slug: input.slug,
        description: input.description,
      });
      const membership = entityManager.create(WorkspaceMemberEntity, {
        workspace: createdWorkspace,
        user: owner,
        role: WorkspaceRole.OWNER,
        joinedAt: new Date(),
      });

      await entityManager.persist([createdWorkspace, membership]).flush();
      await this.workspaceDefaultDocumentProvisioner.provisionDefaultDocument({
        entityManager,
        workspaceId: createdWorkspace.id,
        ownerUserId: owner.id,
      });

      return { workspace: createdWorkspace };
    });

    await this.auditService.record({
      action: 'workspace.created',
      resourceType: 'workspace',
      resourceId: workspace.id,
      metadata: {
        slug: workspace.slug,
      },
    });
    return {
      id: workspace.id,
      version: workspace.version,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      currentUserRole: WorkspaceRole.OWNER,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }
}
