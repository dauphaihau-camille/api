import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { DocumentSubdocReferenceRepository } from '../app/ports/document-subdoc-reference.repository';
import { DocumentEntity } from './persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from './persistence/entities/document-subdoc-reference.entity';

@Injectable()
export class MikroOrmDocumentSubdocReferenceRepository implements DocumentSubdocReferenceRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findReferencingDocuments(workspaceId: string, excludeDocumentId: string): Promise<DocumentEntity[]> {
    return this.entityManager.fork().find(DocumentEntity, {
      workspace: workspaceId,
      archivedAt: null,
      id: { $ne: excludeDocumentId },
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'createdBy', 'updatedBy'],
    });
  }

  async findReferencesBySourceDocument(sourceDocumentId: string): Promise<DocumentSubdocReferenceEntity[]> {
    return this.entityManager.fork().find(DocumentSubdocReferenceEntity, {
      sourceDocument: sourceDocumentId,
    }, {
      populate: ['workspace', 'sourceDocument', 'targetDocument'],
    });
  }

  async findReferencesByTargetDocument(targetDocumentId: string): Promise<DocumentSubdocReferenceEntity[]> {
    return this.entityManager.fork().find(DocumentSubdocReferenceEntity, {
      targetDocument: targetDocumentId,
    }, {
      populate: ['sourceDocument', 'sourceDocument.workspace', 'sourceDocument.teamspace', 'sourceDocument.parentDocument', 'sourceDocument.createdBy', 'sourceDocument.updatedBy'],
    });
  }

  createSubdocReference(payload: Record<string, unknown>): DocumentSubdocReferenceEntity {
    return this.entityManager.create(DocumentSubdocReferenceEntity, payload as never);
  }

  removeSubdocReference(reference: DocumentSubdocReferenceEntity): void {
    this.entityManager.remove(reference);
  }

  persistSubdocReferences(references: DocumentSubdocReferenceEntity[]): void {
    this.entityManager.persist(references);
  }
}
