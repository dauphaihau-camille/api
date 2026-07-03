import type { DocumentEntity } from '../../infra/persistence/entities/document.entity';

export abstract class DocumentTreeQueryRepository {
  abstract findDescendants(workspaceId: string, documentId: string): Promise<DocumentEntity[]>;
  abstract findActiveSubtreeDocuments(workspaceId: string, documentId: string): Promise<DocumentEntity[] | null>;
  abstract findSiblingDocumentsForMove(input: {
    workspaceId: string;
    parentDocumentId?: string;
    teamspaceId?: string;
    excludeDocumentId: string;
  }): Promise<DocumentEntity[]>;
  abstract findFirstSibling(input: {
    workspaceId: string;
    parentDocumentId?: string | null;
    teamspaceId?: string | null;
  }): Promise<DocumentEntity | null>;
}
