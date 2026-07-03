import type { DocumentEntity } from '../../../document/infra/persistence/entities/document.entity';
import type { PublishedDocumentEntity } from '../../infra/persistence/entities/published-document.entity';

export abstract class PublishRepository {
  abstract findDocument(documentId: string): Promise<DocumentEntity | null>;
  abstract findPublishedDocumentByDocumentId(documentId: string): Promise<PublishedDocumentEntity | null>;
  abstract findPublishedDocumentById(publishedDocumentId: string): Promise<PublishedDocumentEntity | null>;
  abstract publishDocument(
    document: DocumentEntity,
    userId: string,
  ): Promise<{ publishedDocument: PublishedDocumentEntity; created: boolean }>;
  abstract unpublishDocument(documentId: string): Promise<PublishedDocumentEntity | null>;
}
