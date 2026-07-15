import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import type { FavoriteStatusSummary } from '../contracts/favorite.contract';
import { FavoriteDocumentNotFoundError } from '../errors/favorite-app.error';
import { resolveFavoriteWorkspaceForUser } from '../policies/resolve-favorite-workspace-for-user';
import { FavoriteRepository } from '../ports/favorite.repository';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';

@Injectable()
export class GetFavoriteStatusUseCase {
  constructor(
    private readonly favoriteRepository: FavoriteRepository,
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<FavoriteStatusSummary> {
    const document = await this.favoriteRepository.findActiveDocumentById(documentId);

    if (!document) {
      throw new FavoriteDocumentNotFoundError(documentId);
    }

    await resolveFavoriteWorkspaceForUser(this.workspaceRepository, document.workspace.id, currentUser);

    const favorite = await this.favoriteRepository.findFavorite({
      documentId: document.id,
      userId: currentUser.userId,
    });

    return {
      documentId,
      isFavorite: Boolean(favorite),
    };
  }
}
