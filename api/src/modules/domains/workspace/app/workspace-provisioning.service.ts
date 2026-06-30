import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
import {
  DEFAULT_CONTENT_FORMAT,
  SORT_STEP,
} from '~/modules/domains/document/app/document-defaults';
import { DocumentEntity } from '~/modules/domains/document/infra/persistence/entities/document.entity';
import { TeamspaceEntity } from '~/modules/domains/teamspace/infra/persistence/entities/teamspace.entity';
import { AuditService } from '~/modules/shared/audit/audit.service';
import { WorkspaceRole } from '../domain/enums/workspace-role.enum';
import { WorkspaceMemberEntity } from '../infra/persistence/entities/workspace-member.entity';
import { WorkspaceEntity } from '../infra/persistence/entities/workspace.entity';
import type { WorkspaceSummary } from './workspace.types';

const DEFAULT_TEAMSPACE_NAME = 'General';
const DEFAULT_TEAMSPACE_DESCRIPTION = 'Shared team docs and collaboration space.';
const DEFAULT_WORKSPACE_DOCUMENTS = [
  {
    title: 'Home',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Welcome to your workspace.' }] },
    ],
  },
  {
    title: 'Getting started',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Capture plans, notes, and decisions here.' }] },
    ],
  },
] as const;

@Injectable()
export class WorkspaceProvisioningService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly auditService: AuditService,
  ) {}

  async createWorkspaceWithDefaults(
    currentUser: AuthenticatedUser,
    input: {
      name: string;
      slug: string;
      description?: string;
    },
  ): Promise<WorkspaceSummary> {
    const { workspace, teamspace, documents } = await this.entityManager.transactional(async (entityManager) => {
      const owner = await entityManager.findOneOrFail(CurrentUserEntity, { id: currentUser.userId });
      const workspace = entityManager.create(WorkspaceEntity, {
        name: input.name,
        slug: input.slug,
        description: input.description,
      });
      const membership = entityManager.create(WorkspaceMemberEntity, {
        workspace,
        user: owner,
        role: WorkspaceRole.OWNER,
        joinedAt: new Date(),
      });
      const teamspace = entityManager.create(TeamspaceEntity, {
        workspace,
        name: DEFAULT_TEAMSPACE_NAME,
        description: DEFAULT_TEAMSPACE_DESCRIPTION,
      });
      const documents = DEFAULT_WORKSPACE_DOCUMENTS.map((item, index) =>
        entityManager.create(DocumentEntity, {
          workspace,
          teamspace,
          title: item.title,
          contentFormat: DEFAULT_CONTENT_FORMAT,
          contentJson: [...item.content],
          sortKey: index * SORT_STEP,
          createdBy: owner,
          updatedBy: owner,
        }),
      );

      await entityManager.persistAndFlush([workspace, membership, teamspace, ...documents]);

      return { workspace, teamspace, documents };
    });

    await this.auditService.record({
      action: 'workspace.created',
      resourceType: 'workspace',
      resourceId: workspace.id,
      metadata: {
        slug: workspace.slug,
      },
    });
    await this.auditService.record({
      action: 'teamspace.created',
      resourceType: 'teamspace',
      resourceId: teamspace.id,
      metadata: {
        workspaceId: workspace.id,
        name: teamspace.name,
        source: 'workspace-bootstrap',
      },
    });
    await Promise.all(documents.map((document) =>
      this.auditService.record({
        action: 'document.created',
        resourceType: 'document',
        resourceId: document.id,
        metadata: {
          workspaceId: workspace.id,
          teamspaceId: teamspace.id,
          source: 'workspace-bootstrap',
        },
      }),
    ));

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
