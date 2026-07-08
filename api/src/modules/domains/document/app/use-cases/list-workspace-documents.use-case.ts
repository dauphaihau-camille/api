import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type {
  DocumentNavigationNode,
  DocumentNavigationPage,
  WorkspaceDocumentNavigation,
} from '../contracts/document.contract';
import type { ListWorkspaceDocumentsInput } from '../contracts/document.input';
import { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import {
  DocumentNotFoundError,
  InvalidDocumentCursorError,
} from '../errors/document-app.error';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { hasMeaningfulContent } from '../utils/document-content.util';

@Injectable()
export class ListWorkspaceDocumentsUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentNavigationQueryRepository: DocumentNavigationQueryRepository,
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

      return this.listDocumentNavigationPage(workspace.id, {
        userId: currentUser.userId,
        parentDocumentId: input.parentDocumentId,
        limit: input.limit,
        cursor: input.cursor,
        query: input.query,
      });
    }

    const teamspaces = await this.documentNavigationQueryRepository.findTeamspaces(workspace.id);

    const [privateDocuments, teamspaceDocuments] = await Promise.all([
      this.listDocumentNavigationPage(workspace.id, {
        userId: currentUser.userId,
        teamspaceId: null,
        parentDocumentId: null,
        limit: input.limit,
        cursor: input.cursor,
        query: input.query,
      }),
      Promise.all(teamspaces.map(async (teamspace) => ({
        id: teamspace.id,
        name: teamspace.name,
        description: teamspace.description,
        documents: await this.listDocumentNavigationPage(workspace.id, {
          userId: currentUser.userId,
          teamspaceId: teamspace.id,
          parentDocumentId: null,
          limit: input.limit,
          cursor: input.cursor,
          query: input.query,
        }),
      }))),
    ]);

    return {
      privateDocuments,
      teamspaces: teamspaceDocuments,
    };
  }

  private async listDocumentNavigationPage(
    workspaceId: string,
    input: {
      userId: string;
      teamspaceId?: string | null;
      parentDocumentId?: string | null;
      limit: number;
      cursor?: string;
      query?: string;
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
    const visibleDocuments = cursor
      ? documents.filter((document) =>
        document.sortKey > cursor.sortKey
            || (document.sortKey === cursor.sortKey && document.id > cursor.id))
      : documents;
    const pagedDocuments = visibleDocuments.slice(0, input.limit + 1);
    const hasMore = pagedDocuments.length > input.limit;
    const items = pagedDocuments.slice(0, input.limit);

    return {
      items: await this.toDocumentNavigationNodes(items, workspaceId, input.userId),
      nextCursor: hasMore ? this.encodeDocumentListCursor(items[items.length - 1]!) : undefined,
    };
  }

  private async toDocumentNavigationNodes(
    documents: DocumentEntity[],
    workspaceId: string,
    userId: string,
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
