import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { AuditService } from '~/modules/shared/audit/audit.service';
import type { FavoriteStatusSummary } from '../contracts/favorite.contract';
import { FavoriteDocumentNotFoundError } from '../errors/favorite-app.error';
import { resolveFavoriteWorkspaceForUser } from '../policies/resolve-favorite-workspace-for-user';
import { FavoriteRepository } from '../ports/favorite.repository';
import { WorkspaceRepository } from '~/modules/domains/workspace/app/ports/workspace.repository';

@Injectable()
export class AddDocumentFavoriteUseCase {
  constructor(
    private readonly favoriteRepository: FavoriteRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly auditService: AuditService,
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

    let favorite = await this.favoriteRepository.findFavorite({
      documentId: document.id,
      userId: currentUser.userId,
    });

    if (!favorite) {
      favorite = await this.favoriteRepository.createFavorite({
        workspaceId: document.workspace.id,
        documentId: document.id,
        userId: currentUser.userId,
      });
      await this.favoriteRepository.saveFavorite(favorite);

      await this.auditService.record({
        action: 'document.favorited',
        resourceType: 'document',
        resourceId: document.id,
        metadata: {
          workspaceId: document.workspace.id,
        },
      });
    }

    return {
      documentId,
      isFavorite: true,
    };
  }
}
