import type {
  PublishedDocumentRecord,
  PublishedDocumentSummary,
} from '../publish.types';

export function toPublishedDocumentSummary(
  documentId: string,
  publishedDocument?: PublishedDocumentRecord | null,
): PublishedDocumentSummary {
  return {
    documentId,
    publishedDocumentId: publishedDocument?.id,
    publishedAt: publishedDocument?.createdAt,
    publicPath: publishedDocument ? `/share/${publishedDocument.id}` : undefined,
  };
}
