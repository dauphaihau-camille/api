import type {
  PublishedDocumentSummary,
} from '../publish.types';
import type { PublishedDocumentEntity } from '../../infra/persistence/entities/published-document.entity';

export function toPublishedDocumentSummary(
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
