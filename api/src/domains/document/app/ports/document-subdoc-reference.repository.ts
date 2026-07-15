import type { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import type { DocumentSubdocReferenceEntity } from '../../infra/persistence/entities/document-subdoc-reference.entity';

export abstract class DocumentSubdocReferenceRepository {
  abstract findReferencingDocuments(workspaceId: string, excludeDocumentId: string): Promise<DocumentEntity[]>;
  abstract findReferencesBySourceDocument(sourceDocumentId: string): Promise<DocumentSubdocReferenceEntity[]>;
  abstract findReferencesByTargetDocument(targetDocumentId: string): Promise<DocumentSubdocReferenceEntity[]>;
  abstract createSubdocReference(payload: Record<string, unknown>): DocumentSubdocReferenceEntity;
  abstract removeSubdocReference(reference: DocumentSubdocReferenceEntity): void;
  abstract persistSubdocReferences(references: DocumentSubdocReferenceEntity[]): void;
}
