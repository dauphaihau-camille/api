import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { DocumentTreeQueryRepository } from '../app/ports/document-tree-query.repository';
import { DocumentEntity } from './persistence/entities/document.entity';

@Injectable()
export class MikroOrmDocumentTreeQueryRepository implements DocumentTreeQueryRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findDescendants(workspaceId: string, documentId: string): Promise<DocumentEntity[]> {
    const entityManager = this.entityManager.fork();
    const descendants: DocumentEntity[] = [];
    let parentDocumentIds = [documentId];

    while (parentDocumentIds.length > 0) {
      const children = await entityManager.find(DocumentEntity, {
        workspace: workspaceId,
        parentDocument: { $in: parentDocumentIds },
      }, {
        populate: ['parentDocument', 'workspace', 'teamspace', 'createdBy', 'updatedBy'],
        orderBy: { sortKey: 'asc', createdAt: 'asc' },
      });

      if (children.length === 0) {
        break;
      }

      descendants.push(...children);
      parentDocumentIds = children.map((document) => document.id);
    }

    return descendants;
  }

  async findActiveSubtreeDocuments(workspaceId: string, documentId: string): Promise<DocumentEntity[] | null> {
    const entityManager = this.entityManager.fork();
    const rootDocument = await entityManager.findOne(DocumentEntity, {
      id: documentId,
      workspace: workspaceId,
      archivedAt: null,
    }, {
      populate: ['parentDocument', 'workspace', 'teamspace', 'createdBy', 'updatedBy'],
    });

    if (!rootDocument) {
      return null;
    }

    const subtree = [rootDocument];
    let parentDocumentIds = [rootDocument.id];

    while (parentDocumentIds.length > 0) {
      const children = await entityManager.find(DocumentEntity, {
        workspace: workspaceId,
        archivedAt: null,
        parentDocument: { $in: parentDocumentIds },
      }, {
        populate: ['parentDocument', 'workspace', 'teamspace', 'createdBy', 'updatedBy'],
        orderBy: { sortKey: 'asc', createdAt: 'asc' },
      });

      if (children.length === 0) {
        break;
      }

      subtree.push(...children);
      parentDocumentIds = children.map((document) => document.id);
    }

    return subtree;
  }

  async findSiblingDocumentsForMove(input: {
    workspaceId: string;
    parentDocumentId?: string;
    teamspaceId?: string;
    excludeDocumentId: string;
  }): Promise<DocumentEntity[]> {
    return this.entityManager.fork().find(DocumentEntity, {
      workspace: input.workspaceId,
      parentDocument: input.parentDocumentId ?? null,
      teamspace: input.teamspaceId ?? null,
      id: { $ne: input.excludeDocumentId },
    }, {
      orderBy: { sortKey: 'asc', createdAt: 'asc' },
    });
  }

  async findFirstSibling(input: {
    workspaceId: string;
    parentDocumentId?: string | null;
    teamspaceId?: string | null;
  }): Promise<DocumentEntity | null> {
    return this.entityManager.fork().findOne(DocumentEntity, {
      workspace: input.workspaceId,
      parentDocument: input.parentDocumentId ?? null,
      teamspace: input.teamspaceId ?? null,
      archivedAt: null,
    }, {
      orderBy: { sortKey: 'asc', createdAt: 'asc' },
    });
  }
}
