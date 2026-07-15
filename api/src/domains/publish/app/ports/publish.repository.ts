import type {
  PublicBreadcrumbItem,
  PublicDocumentSummary,
  PublishableDocument,
  PublishedDocumentRecord,
} from '../publish.types';

export abstract class PublishRepository {
  abstract findDocument(documentId: string): Promise<PublishableDocument | null>;
  abstract findPublishedDocumentByDocumentId(documentId: string): Promise<PublishedDocumentRecord | null>;
  abstract findPublishedDocumentById(publishedDocumentId: string): Promise<PublishedDocumentRecord | null>;
  abstract publishDocument(
    documentId: string,
    userId: string,
  ): Promise<{ publishedDocument: PublishedDocumentRecord; created: boolean }>;
  abstract unpublishDocument(documentId: string): Promise<PublishedDocumentRecord | null>;
  abstract buildPublicDocumentSummary(
    publishedDocumentId: string,
  ): Promise<PublicDocumentSummary>;
  abstract findPublicBreadcrumb(
    documentId: string,
  ): Promise<PublicBreadcrumbItem[]>;
}
