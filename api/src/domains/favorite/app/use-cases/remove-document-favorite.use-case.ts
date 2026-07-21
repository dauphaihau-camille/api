import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { AuditService } from '~/integrations/audit/audit.service';
import type { FavoriteStatusSummary } from '../contracts/favorite.contract';
import { FavoriteDocumentNotFoundError } from '../errors/favorite-app.error';
import { resolveFavoriteWorkspaceForUser } from '../policies/resolve-favorite-workspace-for-user';
import { FavoriteRepository } from '../ports/favorite.repository';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import { DocumentAccessResolver } from '~/domains/document/app/policies/document-access.resolver';

@Injectable()
export class RemoveDocumentFavoriteUseCase {
  constructor(
    private readonly favoriteRepository: FavoriteRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly auditService: AuditService,
    private readonly documentAccessResolver: DocumentAccessResolver,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<FavoriteStatusSummary> {
    const document = await this.favoriteRepository.findActiveDocumentById(documentId);

    if (!document) {
      throw new FavoriteDocumentNotFoundError(documentId);
    }

    const workspace = await resolveFavoriteWorkspaceForUser(this.workspaceRepository, document.workspace.id, currentUser);

    if (!this.documentAccessResolver.resolve({
      actorUserId: currentUser.userId,
      documentOwnerUserId: document.ownerUser.id,
      documentTeamspaceId: document.teamspace?.id,
      workspaceRole: workspace.currentUserRole,
    }).canView) {
      throw new FavoriteDocumentNotFoundError(documentId);
    }

    const favorite = await this.favoriteRepository.findFavorite({
      documentId: document.id,
      userId: currentUser.userId,
    });

    if (favorite) {
      await this.favoriteRepository.removeFavorite(favorite);

      await this.auditService.record({
        action: 'document.unfavorited',
        resourceType: 'document',
        resourceId: document.id,
        metadata: {
          workspaceId: document.workspace.id,
        },
      });
    }

    return {
      documentId,
      isFavorite: false,
    };
  }
}
