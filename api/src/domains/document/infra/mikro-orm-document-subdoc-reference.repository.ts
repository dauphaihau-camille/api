import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Scope } from '@nestjs/common';
import { DocumentSubdocReferenceRepository } from '../app/ports/document-subdoc-reference.repository';
import { DocumentEntity } from './persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from './persistence/entities/document-subdoc-reference.entity';

@Injectable({ scope: Scope.REQUEST })
export class MikroOrmDocumentSubdocReferenceRepository implements DocumentSubdocReferenceRepository {
  private readonly scopedEntityManager: EntityManager;

  constructor(private readonly entityManager: EntityManager) {
    this.scopedEntityManager = entityManager.global ? entityManager.fork() : entityManager;
  }

  async findReferencingDocuments(workspaceId: string, excludeDocumentId: string): Promise<DocumentEntity[]> {
    return this.scopedEntityManager.find(DocumentEntity, {
      workspace: workspaceId,
      archivedAt: null,
      id: { $ne: excludeDocumentId },
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'createdBy', 'ownerUser', 'updatedBy'],
    });
  }

  async findReferencesBySourceDocument(sourceDocumentId: string): Promise<DocumentSubdocReferenceEntity[]> {
    return this.scopedEntityManager.find(DocumentSubdocReferenceEntity, {
      sourceDocument: sourceDocumentId,
    }, {
      populate: ['workspace', 'sourceDocument', 'targetDocument'],
    });
  }

  async findReferencesByTargetDocument(targetDocumentId: string): Promise<DocumentSubdocReferenceEntity[]> {
    return this.scopedEntityManager.find(DocumentSubdocReferenceEntity, {
      targetDocument: targetDocumentId,
    }, {
      populate: ['sourceDocument', 'sourceDocument.workspace', 'sourceDocument.teamspace', 'sourceDocument.parentDocument', 'sourceDocument.createdBy', 'sourceDocument.ownerUser', 'sourceDocument.updatedBy'],
    });
  }

  createSubdocReference(payload: Record<string, unknown>): DocumentSubdocReferenceEntity {
    return this.scopedEntityManager.create(DocumentSubdocReferenceEntity, payload as never);
  }

  removeSubdocReference(reference: DocumentSubdocReferenceEntity): void {
    this.scopedEntityManager.remove(reference);
  }

  persistSubdocReferences(references: DocumentSubdocReferenceEntity[]): void {
    this.scopedEntityManager.persist(references);
  }
}
