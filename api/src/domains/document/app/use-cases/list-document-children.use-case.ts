import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentTreeChild } from '../contracts/document.contract';
import { DocumentNotFoundError } from '../errors/document-app.error';
import { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import { DocumentAccessResolver } from '../policies/document-access.resolver';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { hasMeaningfulContent } from '../utils/document-content.util';

@Injectable()
export class ListDocumentChildrenUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentNavigationQueryRepository: DocumentNavigationQueryRepository,
    private readonly documentAccessResolver: DocumentAccessResolver,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentTreeChild[]> {
    const document = await this.documentNavigationQueryRepository.findDocument(documentId);

    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    const workspace = await resolveWorkspaceForUser(this.workspaceRepository, document.workspace.id, currentUser);

    const parentCapabilities = this.documentAccessResolver.resolve({
      actorUserId: currentUser.userId,
      documentOwnerUserId: document.ownerUser.id,
      documentTeamspaceId: document.teamspace?.id,
      workspaceRole: workspace.currentUserRole,
    });

    if (!parentCapabilities.canView) {
      throw new DocumentNotFoundError(documentId);
    }

    const children = await this.documentNavigationQueryRepository.findChildren({
      workspaceId: document.workspace.id,
      parentDocumentId: document.id,
    });

    const visibleChildren = children.filter((child) => this.documentAccessResolver.resolve({
      actorUserId: currentUser.userId,
      documentOwnerUserId: child.ownerUser.id,
      documentTeamspaceId: child.teamspace?.id,
      workspaceRole: workspace.currentUserRole,
    }).canView);

    const [hasChildrenEntries, favoriteDocumentIds] = await Promise.all([
      Promise.all(visibleChildren.map(async (child) => {
        const count = await this.documentNavigationQueryRepository.countActiveChildren(document.workspace.id, child.id);

        return [child.id, count > 0] as const;
      })),
      this.documentNavigationQueryRepository.findFavoriteDocumentIds({
        workspaceId: document.workspace.id,
        userId: currentUser.userId,
        documentIds: visibleChildren.map((child) => child.id),
      }),
    ]);
    const hasChildrenByDocumentId = new Map<string, boolean>(hasChildrenEntries);
    const favoriteDocumentIdsSet = new Set(favoriteDocumentIds);

    return visibleChildren.map((child) => ({
      id: child.id,
      publicId: child.publicId,
      title: child.title,
      teamspaceId: child.teamspace?.id,
      parentDocumentId: child.parentDocument?.id,
      sortKey: child.sortKey,
      hasChildren: hasChildrenByDocumentId.get(child.id) ?? false,
      hasContent: hasMeaningfulContent(child.contentJson),
      isFavorite: favoriteDocumentIdsSet.has(child.id),
    }));
  }
}
