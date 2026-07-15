import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { CurrentUserEntity } from '~/domains/auth/infra/persistence/entities/current-user.entity';
import {
  DEFAULT_CONTENT_FORMAT,
} from '~/domains/document/app/constants/document.constants';
import { extractDocumentSearchText } from '~/domains/document/app/utils/document-search-text.util';
import { DocumentEntity } from '~/domains/document/infra/persistence/entities/document.entity';
import { AuditService } from '~/integrations/audit/audit.service';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';
import { WorkspaceMemberEntity } from '../../infra/persistence/entities/workspace-member.entity';
import { WorkspaceEntity } from '../../infra/persistence/entities/workspace.entity';
import type { WorkspaceSummary } from '../contracts/workspace.contract';

const DEFAULT_WORKSPACE_DOCUMENT = {
  title: 'Home',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Welcome to your workspace.' }] },
  ],
} as const;

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
    const { workspace, document } = await this.entityManager.transactional(async (entityManager) => {
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
      const defaultDocument = entityManager.create(DocumentEntity, {
        workspace: createdWorkspace,
        title: DEFAULT_WORKSPACE_DOCUMENT.title,
        contentFormat: DEFAULT_CONTENT_FORMAT,
        contentJson: [...DEFAULT_WORKSPACE_DOCUMENT.content],
        searchText: extractDocumentSearchText([...DEFAULT_WORKSPACE_DOCUMENT.content]),
        sortKey: 0,
        createdBy: owner,
        updatedBy: owner,
      });

      await entityManager.persist([createdWorkspace, membership, defaultDocument]).flush();

      return { workspace: createdWorkspace, document: defaultDocument };
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
      action: 'document.created',
      resourceType: 'document',
      resourceId: document.id,
      metadata: {
        workspaceId: workspace.id,
        source: 'workspace-bootstrap',
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
