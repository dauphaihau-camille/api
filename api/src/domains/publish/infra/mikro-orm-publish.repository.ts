import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CurrentUserEntity } from '../../auth/infra/persistence/entities/current-user.entity';
import { DocumentEntity } from '../../document/infra/persistence/entities/document.entity';
import type {
  PublicBreadcrumbItem,
  PublicDocumentSummary,
  PublishableDocument,
  PublishedDocumentRecord,
} from '../app/publish.types';
import { PublishRepository } from '../app/ports/publish.repository';
import { collectReferencedSubdocIds, withPublishedSubdocTargets } from '../app/utils/public-document-content.util';
import { filterCascadePublishedDocuments } from '../app/utils/publish-subtree.util';
import { PublishedDocumentEntity } from './persistence/entities/published-document.entity';

@Injectable()
export class MikroOrmPublishRepository implements PublishRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findDocument(documentId: string): Promise<PublishableDocument | null> {
    const document = await this.entityManager.fork().findOne(DocumentEntity, { id: documentId }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'ownerUser'],
    });

    return document ? this.toPublishableDocument(document) : null;
  }

  async findPublishedDocumentByDocumentId(
    documentId: string,
  ): Promise<PublishedDocumentRecord | null> {
    const publishedDocument = await this.entityManager.fork().findOne(PublishedDocumentEntity, {
      document: documentId,
    });

    return publishedDocument ? this.toPublishedDocumentRecord(publishedDocument) : null;
  }

  async findPublishedDocumentById(
    publishedDocumentId: string,
  ): Promise<PublishedDocumentRecord | null> {
    const publishedDocument = await this.entityManager.fork().findOne(PublishedDocumentEntity, {
      id: publishedDocumentId,
    }, {
      populate: ['document'],
    });

    return publishedDocument ? this.toPublishedDocumentRecord(publishedDocument) : null;
  }

  async publishDocument(
    documentId: string,
    userId: string,
  ): Promise<{ publishedDocument: PublishedDocumentRecord; created: boolean }> {
    const entityManager = this.entityManager.fork();

    const rootDocument = await entityManager.findOne(DocumentEntity, { id: documentId }, {
      populate: ['workspace', 'parentDocument'],
    });

    if (!rootDocument) {
      throw new Error(`Cannot publish missing document ${documentId}.`);
    }

    const subtree = await this.findSubtreeDocuments(entityManager, rootDocument.workspace.id, rootDocument.id, {
      activeOnly: true,
    });
    const actor = await entityManager.findOneOrFail(CurrentUserEntity, { id: userId });
    const resolvedRootDocument = subtree[0];

    if (!resolvedRootDocument) {
      throw new Error(`Cannot publish missing document subtree for ${documentId}.`);
    }

    resolvedRootDocument.publicAccessOverride = undefined;

    const publishableDocuments = filterCascadePublishedDocuments(subtree);
    const existingPublishedDocuments = await entityManager.find(PublishedDocumentEntity, {
      document: { $in: publishableDocuments.map((item) => item.id) },
    });
    const existingPublishedDocumentByDocumentId = new Map(
      existingPublishedDocuments.map((item) => [item.document.id, item]),
    );
    let rootPublishedDocument = existingPublishedDocumentByDocumentId.get(resolvedRootDocument.id) ?? null;
    let rootCreated = false;

    for (const subtreeDocument of publishableDocuments) {
      const existingPublishedDocument =
        existingPublishedDocumentByDocumentId.get(subtreeDocument.id);

      if (existingPublishedDocument) {
        if (subtreeDocument.id === resolvedRootDocument.id) {
          rootPublishedDocument = existingPublishedDocument;
        }
        continue;
      }

      const publishedDocument = entityManager.create(PublishedDocumentEntity, {
        workspace: subtreeDocument.workspace,
        document: subtreeDocument,
        publishedBy: actor,
      });
      entityManager.persist(publishedDocument);

      if (subtreeDocument.id === resolvedRootDocument.id) {
        rootPublishedDocument = publishedDocument;
        rootCreated = true;
      }
    }

    await entityManager.flush();

    if (!rootPublishedDocument) {
      throw new Error(`Failed to resolve published document for ${documentId}.`);
    }

    return {
      publishedDocument: this.toPublishedDocumentRecord(rootPublishedDocument),
      created: rootCreated,
    };
  }

  async unpublishDocument(documentId: string): Promise<PublishedDocumentRecord | null> {
    const entityManager = this.entityManager.fork();
    const rootDocument = await entityManager.findOne(DocumentEntity, {
      id: documentId,
    }, {
      populate: ['workspace', 'parentDocument'],
    });

    if (!rootDocument) {
      return null;
    }

    rootDocument.publicAccessOverride = 'unpublished';

    const subtree = await this.findSubtreeDocuments(entityManager, rootDocument.workspace.id, documentId);
    const publishedDocuments = await entityManager.find(PublishedDocumentEntity, {
      document: { $in: subtree.map((item) => item.id) },
    }, {
      populate: ['document'],
    });
    const rootPublishedDocument =
      publishedDocuments.find((item) => item.document.id === documentId) ?? null;

    if (publishedDocuments.length > 0) {
      entityManager.remove(publishedDocuments);
    }

    await entityManager.flush();

    return rootPublishedDocument ? this.toPublishedDocumentRecord(rootPublishedDocument) : null;
  }

  async buildPublicDocumentSummary(
    publishedDocumentId: string,
  ): Promise<PublicDocumentSummary> {
    const entityManager = this.entityManager.fork();
    const publishedDocument = await entityManager.findOneOrFail(PublishedDocumentEntity, {
      id: publishedDocumentId,
    }, {
      populate: ['document'],
    });
    const document = await entityManager.findOneOrFail(DocumentEntity, {
      id: publishedDocument.document.id,
    }, {
      populate: ['parentDocument'],
    });
    const breadcrumb = await this.findPublicBreadcrumb(document.id);
    const referencedSubdocIds = collectReferencedSubdocIds(document.contentJson);
    const publishedSubdocuments = referencedSubdocIds.length === 0
      ? []
      : await entityManager.find(PublishedDocumentEntity, {
        document: { $in: referencedSubdocIds },
      }, {
        populate: ['document'],
      });
    const publishedSubdocIdByDocumentId = new Map(
      publishedSubdocuments.map((item) => [item.document.id, item.id]),
    );

    return {
      id: document.id,
      publishedDocumentId: publishedDocument.id,
      title: document.title,
      contentFormat: document.contentFormat as 'blocknote_v1',
      content: withPublishedSubdocTargets(document.contentJson, publishedSubdocIdByDocumentId),
      breadcrumb,
      publishedAt: publishedDocument.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  async findPublicBreadcrumb(documentId: string): Promise<PublicBreadcrumbItem[]> {
    const entityManager = this.entityManager.fork();
    const breadcrumbDocuments: DocumentEntity[] = [];
    let currentDocument = await entityManager.findOne(DocumentEntity, {
      id: documentId,
    }, {
      populate: ['parentDocument'],
    });

    while (currentDocument) {
      breadcrumbDocuments.push(currentDocument);

      if (!currentDocument.parentDocument?.id) {
        break;
      }

      currentDocument = await entityManager.findOne(DocumentEntity, {
        id: currentDocument.parentDocument.id,
      }, {
        populate: ['parentDocument'],
      });
    }

    const orderedDocuments = breadcrumbDocuments.reverse();
    const publishedDocuments = await entityManager.find(PublishedDocumentEntity, {
      document: { $in: orderedDocuments.map((item) => item.id) },
    }, {
      populate: ['document'],
    });
    const publishedDocumentByDocumentId = new Map(
      publishedDocuments.map((item) => [item.document.id, item]),
    );

    return orderedDocuments.flatMap((item) => {
      const publishedItem = publishedDocumentByDocumentId.get(item.id);

      if (!publishedItem) {
        return [];
      }

      return [{
        id: item.id,
        title: item.title,
        publishedDocumentId: publishedItem.id,
        publicPath: `/share/${publishedItem.id}`,
      }];
    });
  }

  private async findSubtreeDocuments(
    entityManager: EntityManager,
    workspaceId: string,
    documentId: string,
    input?: { activeOnly?: boolean },
  ): Promise<DocumentEntity[]> {
    const rootDocument = await entityManager.findOne(DocumentEntity, {
      id: documentId,
      workspace: workspaceId,
      ...(input?.activeOnly ? { archivedAt: null } : {}),
    }, {
      populate: ['workspace', 'parentDocument'],
    });

    if (!rootDocument) {
      return [];
    }

    const subtree = [rootDocument];
    let parentDocumentIds = [rootDocument.id];

    while (parentDocumentIds.length > 0) {
      const children = await entityManager.find(DocumentEntity, {
        workspace: workspaceId,
        parentDocument: { $in: parentDocumentIds },
        ...(input?.activeOnly ? { archivedAt: null } : {}),
      }, {
        populate: ['workspace', 'parentDocument'],
        orderBy: { sortKey: 'asc', createdAt: 'asc' },
      });

      if (children.length === 0) {
        break;
      }

      subtree.push(...children);
      parentDocumentIds = children.map((item) => item.id);
    }

    return subtree;
  }

  private toPublishableDocument(document: DocumentEntity): PublishableDocument {
    return {
      id: document.id,
      workspaceId: document.workspace.id,
      ownerUserId: document.ownerUser.id,
      teamspaceId: document.teamspace?.id,
    };
  }

  private toPublishedDocumentRecord(
    publishedDocument: PublishedDocumentEntity,
  ): PublishedDocumentRecord {
    return {
      id: publishedDocument.id,
      documentId: publishedDocument.document.id,
      archivedAt: publishedDocument.document.archivedAt,
      createdAt: publishedDocument.createdAt,
    };
  }
}
