import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import type { DocumentCapabilities } from '~/domains/document/app/policies/document-access.resolver';
import { hasMeaningfulContent } from '~/domains/document/app/utils/document-content.util';
import { DocumentNavigationQueryRepository } from '~/domains/document/app/ports/document-navigation-query.repository';
import { DocumentAccessGrantRepository } from '~/domains/document/app/ports/document-access-grant.repository';
import { DocumentAccessSettingRepository } from '~/domains/document/app/ports/document-access-setting.repository';
import type {
  FavoriteDocumentAccessSummary,
  FavoriteDocumentSummary,
} from '../contracts/favorite.contract';
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
    private readonly documentAccessGrantRepository: DocumentAccessGrantRepository,
    private readonly documentAccessSettingRepository: DocumentAccessSettingRepository,
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

    const teamspaceIds = Array.from(new Set(
      favorites
        .map((favorite) => favorite.document.teamspace?.id)
        .filter((teamspaceId): teamspaceId is string => Boolean(teamspaceId)),
    ));

    const teamspaceMemberRolesByTeamspaceId =
      await this.favoriteRepository.findTeamspaceMemberRolesForUser({
        teamspaceIds,
        userId: currentUser.userId,
      });

    const directGrantPermissionsByDocumentId =
      await this.documentAccessGrantRepository.findActiveGrantPermissionsByDocumentId({
        documentIds: favorites.map((favorite) => favorite.document.id),
        userId: currentUser.userId,
      });

    const workspaceMemberPermissionsByDocumentId =
      await this.documentAccessSettingRepository.findWorkspaceMemberPermissionsByDocumentId({
        documentIds: favorites.map((favorite) => favorite.document.id),
      });

    const favoritesWithCapabilities = favorites.map((favorite) => ({
      favorite,
      capabilities: this.documentAccessResolver.resolve({
        actorUserId: currentUser.userId,
        documentOwnerUserId: favorite.document.ownerUser.id,
        documentTeamspaceId: favorite.document.teamspace?.id,
        teamspaceAccessMode: favorite.document.teamspace?.accessMode,
        teamspaceMemberRole: favorite.document.teamspace?.id
          ? teamspaceMemberRolesByTeamspaceId.get(favorite.document.teamspace.id)
          : undefined,
        directGrantPermission: directGrantPermissionsByDocumentId.get(favorite.document.id),
        workspaceMemberPermission: workspaceMemberPermissionsByDocumentId.get(favorite.document.id),
        workspaceRole: workspace.currentUserRole,
      }),
    }));

    const visibleFavorites = favoritesWithCapabilities.filter(({ capabilities }) => capabilities.canView);

    const hasChildrenEntries = await Promise.all(
      visibleFavorites.map(async ({ favorite }) => ([
        favorite.document.id,
        (await this.documentNavigationQueryRepository.countActiveChildren(
          workspace.id,
          favorite.document.id,
        )) > 0,
      ] as const)),
    );

    const hasChildrenByDocumentId = new Map<string, boolean>(hasChildrenEntries);

    return visibleFavorites.map(({ capabilities, favorite }) =>
      toFavoriteDocumentSummary(favorite, {
        access: toFavoriteDocumentAccessSummary(capabilities),
        hasChildren: hasChildrenByDocumentId.get(favorite.document.id) ?? false,
        hasContent: hasMeaningfulContent(favorite.document.contentJson),
      }));
  }
}

function toFavoriteDocumentAccessSummary(
  capabilities: DocumentCapabilities,
): FavoriteDocumentAccessSummary {
  return {
    permission: capabilities.permission === 'none' ? 'view' : capabilities.permission,
    canView: capabilities.canView,
    canEdit: capabilities.canEdit,
    canManage: capabilities.canManageAccess,
  };
}
