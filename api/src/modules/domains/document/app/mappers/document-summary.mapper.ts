import type { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import type { DocumentSummary } from '../contracts/document.contract';

export function toDocumentSummary(document: DocumentEntity): DocumentSummary {
  return {
    id: document.id,
    publicId: document.publicId,
    version: document.version,
    workspaceId: document.workspace.id,
    teamspaceId: document.teamspace?.id,
    parentDocumentId: document.parentDocument?.id,
    title: document.title,
    contentFormat: document.contentFormat as 'blocknote_v1',
    content: document.contentJson,
    sortKey: document.sortKey,
    archivedAt: document.archivedAt,
    archivedByName: document.archivedAt
      ? (document.updatedBy.displayName ?? document.updatedBy.email)
      : undefined,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
