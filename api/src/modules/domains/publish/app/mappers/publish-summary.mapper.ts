import type {
  PublicDocumentSummary,
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

export function toPublicDocumentSummary(
  publishedDocument: PublishedDocumentEntity,
): PublicDocumentSummary {
  return {
    id: publishedDocument.document.id,
    title: publishedDocument.document.title,
    contentFormat: publishedDocument.document.contentFormat as 'blocknote_v1',
    content: publishedDocument.document.contentJson,
    publishedAt: publishedDocument.createdAt,
    updatedAt: publishedDocument.document.updatedAt,
  };
}
