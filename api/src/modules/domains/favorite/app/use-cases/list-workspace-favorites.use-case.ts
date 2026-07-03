import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
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

    return favorites.map(toFavoriteDocumentSummary);
  }
}
