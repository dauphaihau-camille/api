import { DocumentFavoriteEntity } from '../../infra/persistence/entities/document-favorite.entity';
import type { FavoriteDocumentSummary } from '../contracts/favorite.contract';

export function toFavoriteDocumentSummary(
  favorite: DocumentFavoriteEntity,
): FavoriteDocumentSummary {
  return {
    documentId: favorite.document.id,
    publicId: favorite.document.publicId,
    workspaceId: favorite.workspace.id,
    teamspaceId: favorite.document.teamspace?.id,
    parentDocumentId: favorite.document.parentDocument?.id,
    title: favorite.document.title,
    sortKey: favorite.document.sortKey,
    favoritedAt: favorite.createdAt,
  };
}
