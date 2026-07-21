import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { hasMeaningfulContent } from '~/domains/document/app/utils/document-content.util';
import { DocumentNavigationQueryRepository } from '~/domains/document/app/ports/document-navigation-query.repository';
import type { FavoriteDocumentSummary } from '../contracts/favorite.contract';
import { toFavoriteDocumentSummary } from '../mappers/favorite-summary.mapper';
import { resolveFavoriteWorkspaceForUser } from '../policies/resolve-favorite-workspace-for-user';
import { FavoriteRepository } from '../ports/favorite.repository';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import { DocumentAccessResolver } from '~/domains/document/app/policies/document-access.resolver';

@Injectable()
export class ListWorkspaceFavoritesUseCase {
  constructor(
    private readonly favoriteRepository: FavoriteRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentNavigationQueryRepository: DocumentNavigationQueryRepository,
    private readonly documentAccessResolver: DocumentAccessResolver,
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
    const visibleFavorites = favorites.filter((favorite) => this.documentAccessResolver.resolve({
      actorUserId: currentUser.userId,
      documentOwnerUserId: favorite.document.ownerUser.id,
      documentTeamspaceId: favorite.document.teamspace?.id,
      workspaceRole: workspace.currentUserRole,
    }).canView);

    const hasChildrenEntries = await Promise.all(
      visibleFavorites.map(async (favorite) => ([
        favorite.document.id,
        (await this.documentNavigationQueryRepository.countActiveChildren(
          workspace.id,
          favorite.document.id,
        )) > 0,
      ] as const)),
    );
    const hasChildrenByDocumentId = new Map<string, boolean>(hasChildrenEntries);

    return visibleFavorites.map((favorite) =>
      toFavoriteDocumentSummary(favorite, {
        hasChildren: hasChildrenByDocumentId.get(favorite.document.id) ?? false,
        hasContent: hasMeaningfulContent(favorite.document.contentJson),
      }));
  }
}
