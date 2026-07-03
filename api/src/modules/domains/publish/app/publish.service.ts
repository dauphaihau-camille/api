import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { DocumentEntity } from '~/modules/domains/document/infra/persistence/entities/document.entity';
import { AuditService } from '~/modules/shared/audit/audit.service';
import {
  canEditWorkspace,
} from '../../workspace/app/workspace-permissions';
import { WorkspaceRepository } from '../../workspace/app/workspace.repository';
import type {
  PublicDocumentSummary,
  PublishedDocumentSummary,
} from './publish.types';
import { PublishedDocumentEntity } from '../infra/persistence/entities/published-document.entity';
import {
  ArchivedDocumentPublicAccessDeniedError,
  PublishDocumentNotFoundError,
  PublishedDocumentNotFoundError,
  PublishPermissionDeniedError,
  PublishWorkspaceNotFoundError,
} from './errors/publish-app.error';

@Injectable()
export class PublishService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly auditService: AuditService,
  ) {}

  async getStatusForDocument(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<PublishedDocumentSummary> {
    const entityManager = this.entityManager.fork();
    const document = await this.findDocumentOrThrow(documentId, entityManager);
    await this.resolveWorkspaceForUser(document.workspace.id, currentUser);

    const publishedDocument = await entityManager.findOne(PublishedDocumentEntity, {
      document: document.id,
    });

    return this.toStatus(document.id, publishedDocument);
  }

  async publishDocument(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<PublishedDocumentSummary> {
    const entityManager = this.entityManager.fork();
    const document = await this.findDocumentOrThrow(documentId, entityManager);
    const workspace = await this.resolveWorkspaceForUser(document.workspace.id, currentUser);
    this.assertCanManagePublish(workspace.currentUserRole);

    let publishedDocument = await entityManager.findOne(PublishedDocumentEntity, {
      document: document.id,
    });

    if (!publishedDocument) {
      const actor = await entityManager.findOneOrFail(CurrentUserEntity, { id: currentUser.userId });
      publishedDocument = entityManager.create(PublishedDocumentEntity, {
        workspace: document.workspace,
        document,
        publishedBy: actor,
      });
      await entityManager.persist(publishedDocument).flush();

      await this.auditService.record({
        action: 'document.published',
        resourceType: 'document',
        resourceId: document.id,
        metadata: {
          workspaceId: document.workspace.id,
          publishedDocumentId: publishedDocument.id,
        },
      });
    }

    return this.toStatus(document.id, publishedDocument);
  }

  async unpublishDocument(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<PublishedDocumentSummary> {
    const entityManager = this.entityManager.fork();
    const document = await this.findDocumentOrThrow(documentId, entityManager);
    const workspace = await this.resolveWorkspaceForUser(document.workspace.id, currentUser);
    this.assertCanManagePublish(workspace.currentUserRole);

    const publishedDocument = await entityManager.findOne(PublishedDocumentEntity, {
      document: document.id,
    });

    if (publishedDocument) {
      await entityManager.remove(publishedDocument).flush();

      await this.auditService.record({
        action: 'document.unpublished',
        resourceType: 'document',
        resourceId: document.id,
        metadata: {
          workspaceId: document.workspace.id,
          publishedDocumentId: publishedDocument.id,
        },
      });
    }

    return {
      documentId,
    };
  }

  async getPublicDocument(
    publishedDocumentId: string,
  ): Promise<PublicDocumentSummary> {
    const publishedDocument = await this.entityManager.fork().findOne(PublishedDocumentEntity, {
      id: publishedDocumentId,
    }, {
      populate: ['document'],
    });

    if (!publishedDocument) {
      throw new PublishedDocumentNotFoundError(publishedDocumentId);
    }

    if (publishedDocument.document.archivedAt) {
      throw new ArchivedDocumentPublicAccessDeniedError();
    }

    return {
      id: publishedDocument.document.id,
      title: publishedDocument.document.title,
      contentFormat: publishedDocument.document.contentFormat as 'blocknote_v1',
      content: publishedDocument.document.contentJson,
      publishedAt: publishedDocument.createdAt,
      updatedAt: publishedDocument.document.updatedAt,
    };
  }

  private async findDocumentOrThrow(
    documentId: string,
    entityManager: EntityManager,
  ): Promise<DocumentEntity> {
    const document = await entityManager.findOne(DocumentEntity, {
      id: documentId,
    }, {
      populate: ['workspace'],
    });

    if (!document) {
      throw new PublishDocumentNotFoundError(documentId);
    }

    return document;
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
      throw new PublishWorkspaceNotFoundError(workspaceIdentifier);
    }

    return workspace;
  }

  private assertCanManagePublish(role: Parameters<typeof canEditWorkspace>[0]): void {
    if (!canEditWorkspace(role)) {
      throw new PublishPermissionDeniedError();
    }
  }

  private toStatus(
    documentId: string,
    publishedDocument?: PublishedDocumentEntity | null,
  ): PublishedDocumentSummary {
    return {
      documentId,
      publishedDocumentId: publishedDocument?.id,
      publishedAt: publishedDocument?.createdAt,
      publicPath: publishedDocument ? `/share/${publishedDocument.id}` : undefined,
    };
  }
}
