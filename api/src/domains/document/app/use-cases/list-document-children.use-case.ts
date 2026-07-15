import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentTreeChild } from '../contracts/document.contract';
import { DocumentNotFoundError } from '../errors/document-app.error';
import { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { hasMeaningfulContent } from '../utils/document-content.util';

@Injectable()
export class ListDocumentChildrenUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentNavigationQueryRepository: DocumentNavigationQueryRepository,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentTreeChild[]> {
    const document = await this.documentNavigationQueryRepository.findDocument(documentId);

    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    await resolveWorkspaceForUser(this.workspaceRepository, document.workspace.id, currentUser);

    const children = await this.documentNavigationQueryRepository.findChildren({
      workspaceId: document.workspace.id,
      parentDocumentId: document.id,
    });

    const [hasChildrenEntries, favoriteDocumentIds] = await Promise.all([
      Promise.all(children.map(async (child) => {
        const count = await this.documentNavigationQueryRepository.countActiveChildren(document.workspace.id, child.id);

        return [child.id, count > 0] as const;
      })),
      this.documentNavigationQueryRepository.findFavoriteDocumentIds({
        workspaceId: document.workspace.id,
        userId: currentUser.userId,
        documentIds: children.map((child) => child.id),
      }),
    ]);
    const hasChildrenByDocumentId = new Map<string, boolean>(hasChildrenEntries);
    const favoriteDocumentIdsSet = new Set(favoriteDocumentIds);

    return children.map((child) => ({
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
