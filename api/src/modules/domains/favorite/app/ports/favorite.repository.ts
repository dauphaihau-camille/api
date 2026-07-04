import type { DocumentEntity } from '~/modules/domains/document/infra/persistence/entities/document.entity';
import type { DocumentFavoriteEntity } from '../../infra/persistence/entities/document-favorite.entity';

export abstract class FavoriteRepository {
  abstract findFavoritesForWorkspace(input: {
    workspaceId: string;
    userId: string;
  }): Promise<DocumentFavoriteEntity[]>;

  abstract findActiveDocumentById(documentId: string): Promise<DocumentEntity | null>;

  abstract findFavorite(input: {
    documentId: string;
    userId: string;
  }): Promise<DocumentFavoriteEntity | null>;

  abstract createFavorite(input: {
    workspaceId: string;
    documentId: string;
    userId: string;
  }): Promise<DocumentFavoriteEntity>;

  abstract saveFavorite(favorite: DocumentFavoriteEntity): Promise<void>;

  abstract removeFavorite(favorite: DocumentFavoriteEntity): Promise<void>;
}
