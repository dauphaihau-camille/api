import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import type { TeamspaceMemberRole } from '~/domains/teamspace/domain/enums/teamspace-member-role.enum';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentEntity } from '../../infra/persistence/entities/document.entity';
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

    const parentTeamspaceMemberRole = await this.findTeamspaceMemberRole(
      currentUser.userId,
      document.teamspace?.id,
    );
    const parentCapabilities = this.documentAccessResolver.resolve({
      actorUserId: currentUser.userId,
      documentOwnerUserId: document.ownerUser.id,
      documentTeamspaceId: document.teamspace?.id,
      teamspaceAccessMode: document.teamspace?.accessMode,
      teamspaceMemberRole: parentTeamspaceMemberRole,
      workspaceRole: workspace.currentUserRole,
    });

    if (!parentCapabilities.canView) {
      throw new DocumentNotFoundError(documentId);
    }

    const children = await this.documentNavigationQueryRepository.findChildren({
      workspaceId: document.workspace.id,
      parentDocumentId: document.id,
    });
    const teamspaceMemberRolesByTeamspaceId = await this.findTeamspaceMemberRolesByTeamspaceId(
      currentUser.userId,
      children,
    );

    const visibleChildren = children.filter((child) => this.documentAccessResolver.resolve({
      actorUserId: currentUser.userId,
      documentOwnerUserId: child.ownerUser.id,
      documentTeamspaceId: child.teamspace?.id,
      teamspaceAccessMode: child.teamspace?.accessMode,
      teamspaceMemberRole: child.teamspace?.id
        ? teamspaceMemberRolesByTeamspaceId.get(child.teamspace.id)
        : undefined,
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

  private async findTeamspaceMemberRole(
    userId: string,
    teamspaceId?: string,
  ): Promise<TeamspaceMemberRole | undefined> {
    if (!teamspaceId) {
      return undefined;
    }

    const rolesByTeamspaceId = await this.documentNavigationQueryRepository.findTeamspaceMemberRolesByTeamspaceId({
      teamspaceIds: [teamspaceId],
      userId,
    });

    return rolesByTeamspaceId.get(teamspaceId);
  }

  private async findTeamspaceMemberRolesByTeamspaceId(
    userId: string,
    documents: DocumentEntity[],
  ): Promise<Map<string, TeamspaceMemberRole>> {
    const teamspaceIds = Array.from(new Set(
      documents
        .map((document) => document.teamspace?.id)
        .filter((teamspaceId): teamspaceId is string => Boolean(teamspaceId)),
    ));

    if (teamspaceIds.length === 0) {
      return new Map();
    }

    return this.documentNavigationQueryRepository.findTeamspaceMemberRolesByTeamspaceId({
      teamspaceIds,
      userId,
    });
  }
}
