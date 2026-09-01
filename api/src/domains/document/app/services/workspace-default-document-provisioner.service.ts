import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { UserEntity } from '../../../user/infra/persistence/entities/user.entity';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import type {
  ProvisionDefaultWorkspaceDocumentInput,
} from '~/domains/workspace/app/ports/workspace-default-document-provisioner';
import { WorkspaceDefaultDocumentProvisioner } from '~/domains/workspace/app/ports/workspace-default-document-provisioner';
import { AuditService } from '~/integrations/audit/audit.service';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { DEFAULT_CONTENT_FORMAT } from '../constants/document.constants';
import { extractDocumentSearchText } from '../utils/document-search-text.util';

const DEFAULT_WORKSPACE_DOCUMENT = {
  title: 'Home',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Welcome to your workspace.' }] },
  ],
} as const;

@Injectable()
export class WorkspaceDefaultDocumentProvisionerService
implements WorkspaceDefaultDocumentProvisioner {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly auditService: AuditService,
  ) {}

  async provisionDefaultDocument(
    input: ProvisionDefaultWorkspaceDocumentInput,
  ): Promise<{ documentId: string }> {
    const entityManager = this.entityManager.fork();
    const { ownerUserId, workspaceId } = input;
    const document = this.createDefaultDocument(entityManager, workspaceId, ownerUserId);

    await entityManager.persist(document).flush();

    await this.auditService.record({
      action: 'document.created',
      resourceType: 'document',
      resourceId: document.id,
      metadata: {
        workspaceId,
        source: 'workspace-bootstrap',
      },
    });

    return { documentId: document.id };
  }

  private createDefaultDocument(
    entityManager: EntityManager,
    workspaceId: string,
    ownerUserId: string,
  ): DocumentEntity {
    const owner = entityManager.getReference(UserEntity, ownerUserId);
    const workspace = entityManager.getReference(WorkspaceEntity, workspaceId);
    const contentJson = [...DEFAULT_WORKSPACE_DOCUMENT.content];

    return entityManager.create(DocumentEntity, {
      workspace,
      title: DEFAULT_WORKSPACE_DOCUMENT.title,
      contentFormat: DEFAULT_CONTENT_FORMAT,
      contentJson,
      searchText: extractDocumentSearchText(contentJson),
      sortKey: 0,
      createdBy: owner,
      ownerUser: owner,
      updatedBy: owner,
    });
  }
}
