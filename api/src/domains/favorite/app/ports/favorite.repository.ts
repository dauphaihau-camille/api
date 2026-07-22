import type { DocumentEntity } from '~/domains/document/infra/persistence/entities/document.entity';
import type { TeamspaceMemberRole } from '~/domains/teamspace/domain/enums/teamspace-member-role.enum';
import type { DocumentFavoriteEntity } from '../../infra/persistence/entities/document-favorite.entity';

export abstract class FavoriteRepository {
  abstract findFavoritesForWorkspace(input: {
    workspaceId: string;
    userId: string;
  }): Promise<DocumentFavoriteEntity[]>;

  abstract findTeamspaceMemberRolesForUser(input: {
    teamspaceIds: string[];
    userId: string;
  }): Promise<Map<string, TeamspaceMemberRole>>;

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
