import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import type { TeamspaceMemberRole } from '~/domains/teamspace/domain/enums/teamspace-member-role.enum';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import type {
  DocumentNavigationNode,
  DocumentNavigationPage,
  WorkspaceDocumentNavigation,
} from '../contracts/document.contract';
import type { ListWorkspaceDocumentsInput } from '../contracts/document.input';
import { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { DocumentAccessGrantRepository } from '../ports/document-access-grant.repository';
import { DocumentAccessSettingRepository } from '../ports/document-access-setting.repository';
import {
  DocumentNotFoundError,
  InvalidDocumentCursorError,
} from '../errors/document-app.error';
import { DocumentAccessResolver } from '../policies/document-access.resolver';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { hasMeaningfulContent } from '../utils/document-content.util';

type DocumentNavigationPageMode = 'viewable' | 'private' | 'direct-shared';

@Injectable()
export class ListWorkspaceDocumentsUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentNavigationQueryRepository: DocumentNavigationQueryRepository,
    private readonly documentAccessResolver: DocumentAccessResolver,
    private readonly documentAccessGrantRepository: DocumentAccessGrantRepository,
    private readonly documentAccessSettingRepository: DocumentAccessSettingRepository,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    input: ListWorkspaceDocumentsInput,
  ): Promise<WorkspaceDocumentNavigation | DocumentNavigationPage> {
    const workspace = await resolveWorkspaceForUser(this.workspaceRepository, workspaceIdentifier, currentUser);

    if (input.parentDocumentId) {
      const parentDocument = await this.documentNavigationQueryRepository.findDocument(input.parentDocumentId);

      if (!parentDocument || parentDocument.workspace.id !== workspace.id) {
        throw new DocumentNotFoundError(input.parentDocumentId);
      }

      const parentTeamspaceMemberRole = await this.findTeamspaceMemberRole(
        currentUser.userId,
        parentDocument.teamspace?.id,
      );

      const parentDirectGrant = await this.documentAccessGrantRepository.findActiveGrant({
        documentId: parentDocument.id,
        userId: currentUser.userId,
      });
      const parentAncestorGrant = await this.documentAccessGrantRepository.findStrongestActiveGrantInAncestors({
        documentId: parentDocument.id,
        userId: currentUser.userId,
      });

      const parentAccessSetting =
        await this.documentAccessSettingRepository.findByDocumentId(parentDocument.id);

      const parentCapabilities = this.documentAccessResolver.resolve({
        actorUserId: currentUser.userId,
        documentOwnerUserId: parentDocument.ownerUser.id,
        documentTeamspaceId: parentDocument.teamspace?.id,
        teamspaceAccessMode: parentDocument.teamspace?.accessMode,
        teamspaceMemberRole: parentTeamspaceMemberRole,
        directGrantPermission: parentDirectGrant?.permission,
        ancestorGrantPermission: parentAncestorGrant?.permission,
        workspaceMemberPermission: parentAccessSetting?.workspaceMemberPermission,
        workspaceRole: workspace.currentUserRole,
      });

      if (!parentCapabilities.canView) {
        throw new DocumentNotFoundError(input.parentDocumentId);
      }

      return this.listDocumentNavigationPage(workspace.id, {
        workspaceRole: workspace.currentUserRole,
        userId: currentUser.userId,
        parentDocumentId: input.parentDocumentId,
        limit: input.limit,
        cursor: input.cursor,
        query: input.query,
      });
    }

    const teamspaces = await this.documentNavigationQueryRepository.findTeamspaces(workspace.id);

    const [privateDocuments, sharedDocuments, teamspaceDocuments] = await Promise.all([
      this.listDocumentNavigationPage(workspace.id, {
        workspaceRole: workspace.currentUserRole,
        userId: currentUser.userId,
        teamspaceId: null,
        parentDocumentId: null,
        limit: input.limit,
        cursor: input.cursor,
        query: input.query,
        mode: 'private',
      }),
      this.listDocumentNavigationPage(workspace.id, {
        workspaceRole: workspace.currentUserRole,
        userId: currentUser.userId,
        teamspaceId: null,
        parentDocumentId: null,
        limit: input.limit,
        cursor: input.cursor,
        query: input.query,
        mode: 'direct-shared',
      }),
      Promise.all(teamspaces.map(async (teamspace) => ({
        id: teamspace.id,
        name: teamspace.name,
        description: teamspace.description,
        documents: await this.listDocumentNavigationPage(workspace.id, {
          workspaceRole: workspace.currentUserRole,
          userId: currentUser.userId,
          teamspaceId: teamspace.id,
          parentDocumentId: null,
          limit: input.limit,
          cursor: input.cursor,
          query: input.query,
          mode: 'viewable',
        }),
      }))),
    ]);

    return {
      privateDocuments,
      sharedDocuments,
      teamspaces: teamspaceDocuments,
    };
  }

  private async listDocumentNavigationPage(
    workspaceId: string,
    input: {
      userId: string;
      workspaceRole: WorkspaceRole;
      teamspaceId?: string | null;
      parentDocumentId?: string | null;
      limit: number;
      cursor?: string;
      query?: string;
      mode?: DocumentNavigationPageMode;
    },
  ): Promise<DocumentNavigationPage> {
    const documents = await this.documentNavigationQueryRepository.findRootDocuments({
      workspaceId,
      teamspaceId: input.teamspaceId,
      parentDocumentId: input.parentDocumentId,
      query: input.query,
    });

    const cursor = input.cursor
      ? this.decodeDocumentListCursor(input.cursor)
      : undefined;

    const teamspaceMemberRolesByTeamspaceId = await this.findTeamspaceMemberRolesByTeamspaceId(
      input.userId,
      documents,
    );

    const directGrantPermissionsByDocumentId =
      await this.documentAccessGrantRepository.findActiveGrantPermissionsByDocumentId({
        documentIds: documents.map((document) => document.id),
        userId: input.userId,
      });
    const ancestorGrantPermissionsByDocumentId =
      await this.documentAccessGrantRepository.findStrongestActiveGrantPermissionsInAncestorsByDocumentId({
        documentIds: documents.map((document) => document.id),
        userId: input.userId,
      });

    const workspaceMemberPermissionsByDocumentId =
      await this.documentAccessSettingRepository.findWorkspaceMemberPermissionsByDocumentId({
        documentIds: documents.map((document) => document.id),
      });
    const documentIdsWithActiveGrants =
      await this.documentAccessGrantRepository.findDocumentIdsWithActiveGrantsIncludingAncestors(
        documents.map((document) => document.id),
      );

    const documentsWithCapabilities = documents.map((document) => ({
      document,
      capabilities: this.documentAccessResolver.resolve({
        actorUserId: input.userId,
        documentOwnerUserId: document.ownerUser.id,
        documentTeamspaceId: document.teamspace?.id,
        teamspaceAccessMode: document.teamspace?.accessMode,
        teamspaceMemberRole: document.teamspace?.id
          ? teamspaceMemberRolesByTeamspaceId.get(document.teamspace.id)
          : undefined,
        directGrantPermission: directGrantPermissionsByDocumentId.get(document.id),
        ancestorGrantPermission: ancestorGrantPermissionsByDocumentId.get(document.id),
        documentHasActiveGrants: documentIdsWithActiveGrants.has(document.id),
        workspaceMemberPermission: workspaceMemberPermissionsByDocumentId.get(document.id),
        workspaceRole: input.workspaceRole,
      }),
    }));

    const accessScopeByDocumentId = new Map(
      documentsWithCapabilities.map(({ capabilities, document }) => [
        document.id,
        capabilities.accessScope,
      ]),
    );

    const mode = input.mode ?? 'viewable';

    const accessFilteredDocuments = documentsWithCapabilities
      .filter(({ capabilities, document }) =>
        capabilities.canView
        && this.matchesNavigationPageMode({
          document,
          documentIdsWithActiveGrants,
          directGrantPermissionsByDocumentId,
          mode,
          userId: input.userId,
        }))
      .map(({ document }) => document);

    const visibleDocuments = cursor
      ? accessFilteredDocuments.filter((document) =>
        document.sortKey > cursor.sortKey
            || (document.sortKey === cursor.sortKey && document.id > cursor.id))
      : accessFilteredDocuments;

    const pagedDocuments = visibleDocuments.slice(0, input.limit + 1);
    const hasMore = pagedDocuments.length > input.limit;
    const items = pagedDocuments.slice(0, input.limit);

    return {
      items: await this.toDocumentNavigationNodes(items, workspaceId, input.userId, accessScopeByDocumentId),
      nextCursor: hasMore ? this.encodeDocumentListCursor(items[items.length - 1]!) : undefined,
    };
  }

  private matchesNavigationPageMode(input: {
    directGrantPermissionsByDocumentId: Map<string, unknown>;
    documentIdsWithActiveGrants: Set<string>;
    document: DocumentEntity;
    mode: DocumentNavigationPageMode;
    userId: string;
  }): boolean {
    switch (input.mode) {
      case 'private':
        return !input.document.teamspace
          && input.document.ownerUser.id === input.userId
          && !input.documentIdsWithActiveGrants.has(input.document.id);
      case 'direct-shared':
        return !input.document.teamspace
          && (
            input.directGrantPermissionsByDocumentId.has(input.document.id)
            || (
              input.document.ownerUser.id === input.userId
              && input.documentIdsWithActiveGrants.has(input.document.id)
            )
          );
      case 'viewable':
        return true;
    }
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

  private async toDocumentNavigationNodes(
    documents: DocumentEntity[],
    workspaceId: string,
    userId: string,
    accessScopeByDocumentId: Map<string, DocumentNavigationNode['accessScope']> = new Map(),
  ): Promise<DocumentNavigationNode[]> {
    const [hasChildrenEntries, favoriteDocumentIds] = await Promise.all([
      Promise.all(documents.map(async (document) => {
        const childCount = await this.documentNavigationQueryRepository.countActiveChildren(workspaceId, document.id);

        return [document.id, childCount > 0] as const;
      })),
      this.documentNavigationQueryRepository.findFavoriteDocumentIds({
        workspaceId,
        userId,
        documentIds: documents.map((document) => document.id),
      }),
    ]);
    const hasChildrenByDocumentId = new Map<string, boolean>(hasChildrenEntries);
    const favoriteDocumentIdsSet = new Set(favoriteDocumentIds);

    return documents.map((document) => ({
      id: document.id,
      publicId: document.publicId,
      accessScope: accessScopeByDocumentId.get(document.id) ??
        (document.teamspace ? 'teamspace' : 'private'),
      isOwnedByCurrentUser: document.ownerUser.id === userId,
      title: document.title,
      teamspaceId: document.teamspace?.id,
      parentDocumentId: document.parentDocument?.id,
      sortKey: document.sortKey,
      hasChildren: hasChildrenByDocumentId.get(document.id) ?? false,
      hasContent: hasMeaningfulContent(document.contentJson),
      isFavorite: favoriteDocumentIdsSet.has(document.id),
    }));
  }

  private encodeDocumentListCursor(document: Pick<DocumentEntity, 'id' | 'sortKey'>): string {
    return Buffer.from(JSON.stringify({
      id: document.id,
      sortKey: document.sortKey,
    })).toString('base64url');
  }

  private decodeDocumentListCursor(cursor: string): { id: string; sortKey: number } {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
        id?: unknown;
        sortKey?: unknown;
      };

      if (typeof parsed.id !== 'string' || typeof parsed.sortKey !== 'number') {
        throw new Error('Invalid cursor');
      }

      return {
        id: parsed.id,
        sortKey: parsed.sortKey,
      };
    }
    catch {
      throw new InvalidDocumentCursorError();
    }
  }
}
