import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { hasMeaningfulContent } from '~/modules/domains/document/app/utils/document-content.util';
import { DocumentNavigationQueryRepository } from '~/modules/domains/document/app/ports/document-navigation-query.repository';
import type { FavoriteDocumentSummary } from '../contracts/favorite.contract';
import { toFavoriteDocumentSummary } from '../mappers/favorite-summary.mapper';
import { resolveFavoriteWorkspaceForUser } from '../policies/resolve-favorite-workspace-for-user';
import { FavoriteRepository } from '../ports/favorite.repository';
import { WorkspaceRepository } from '~/modules/domains/workspace/app/ports/workspace.repository';

@Injectable()
export class ListWorkspaceFavoritesUseCase {
  constructor(
    private readonly favoriteRepository: FavoriteRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentNavigationQueryRepository: DocumentNavigationQueryRepository,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<FavoriteDocumentSummary[]> {
    const workspace = await resolveFavoriteWorkspaceForUser(
      this.workspaceRepository,
      workspaceIdentifier,
      currentUser,
    );
    const favorites = await this.favoriteRepository.findFavoritesForWorkspace({
      workspaceId: workspace.id,
      userId: currentUser.userId,
    });

    const hasChildrenEntries = await Promise.all(
      favorites.map(async (favorite) => ([
        favorite.document.id,
        (await this.documentNavigationQueryRepository.countActiveChildren(
          workspace.id,
          favorite.document.id,
        )) > 0,
      ] as const)),
    );
    const hasChildrenByDocumentId = new Map<string, boolean>(hasChildrenEntries);

    return favorites.map((favorite) =>
      toFavoriteDocumentSummary(favorite, {
        hasChildren: hasChildrenByDocumentId.get(favorite.document.id) ?? false,
        hasContent: hasMeaningfulContent(favorite.document.contentJson),
      }));
  }
}
