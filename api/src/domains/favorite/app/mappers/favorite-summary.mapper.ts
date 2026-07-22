import type { DocumentFavoriteEntity } from '../../infra/persistence/entities/document-favorite.entity';
import type {
  FavoriteDocumentAccessSummary,
  FavoriteDocumentSummary,
} from '../contracts/favorite.contract';

export function toFavoriteDocumentSummary(
  favorite: DocumentFavoriteEntity,
  input: {
    access: FavoriteDocumentAccessSummary;
    hasChildren: boolean;
    hasContent: boolean;
  },
): FavoriteDocumentSummary {
  return {
    documentId: favorite.document.id,
    publicId: favorite.document.publicId,
    workspaceId: favorite.workspace.id,
    teamspaceId: favorite.document.teamspace?.id,
    parentDocumentId: favorite.document.parentDocument?.id,
    title: favorite.document.title,
    sortKey: favorite.document.sortKey,
    hasChildren: input.hasChildren,
    hasContent: input.hasContent,
    favoritedAt: favorite.createdAt,
    access: input.access,
  };
}
