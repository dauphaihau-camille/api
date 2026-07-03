import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { DocumentEntity } from '~/modules/domains/document/infra/persistence/entities/document.entity';
import { DocumentVisitEntity } from '~/modules/domains/document/infra/persistence/entities/document-visit.entity';
import { WorkspaceRepository } from '../../workspace/app/workspace.repository';
import type { SearchDocumentSummary } from './search.types';
import { SearchWorkspaceNotFoundError } from './errors/search-app.error';

@Injectable()
export class SearchService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  async searchWorkspaceDocuments(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    query?: string,
    limit = 20,
  ): Promise<SearchDocumentSummary[]> {
    const workspace = await this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);
    const entityManager = this.entityManager.fork();
    const normalizedQuery = query?.trim();

    if (!normalizedQuery) {
      const visits = await entityManager.find(DocumentVisitEntity, {
        workspace: workspace.id,
        user: currentUser.userId,
        document: {
          archivedAt: null,
        },
      }, {
        populate: ['document', 'document.workspace', 'document.teamspace', 'document.parentDocument', 'document.updatedBy'],
        orderBy: {
          lastVisitedAt: 'desc',
        },
        limit,
      });

      return this.mapDocumentsToSummaries(
        visits.map((visit) => ({
          document: visit.document,
          visitedAt: visit.lastVisitedAt,
        })),
        entityManager,
      );
    }

    return this.mapDocumentsToSummaries(
      await this.findMatchedDocuments(entityManager, workspace.id, normalizedQuery, limit),
      entityManager,
    );
  }

  private async mapDocumentsToSummaries(
    items: Array<{
      document: DocumentEntity;
      matchedText?: string;
      visitedAt?: Date;
    }>,
    entityManager: EntityManager,
  ): Promise<SearchDocumentSummary[]> {
    const breadcrumbCache = new Map<string, DocumentEntity | null>();

    return Promise.all(items.map(async (item) => ({
      documentId: item.document.id,
      publicId: item.document.publicId,
      workspaceId: item.document.workspace.id,
      teamspaceId: item.document.teamspace?.id,
      parentDocumentId: item.document.parentDocument?.id,
      title: item.document.title,
      hasContent: this.hasMeaningfulContent(item.document.contentJson),
      breadcrumbPath: await this.buildBreadcrumbPath(item.document, entityManager, breadcrumbCache),
      updatedByName: item.document.updatedBy.displayName ?? item.document.updatedBy.email,
      matchedText: item.matchedText,
      updatedAt: item.document.updatedAt,
      visitedAt: item.visitedAt,
    })));
  }

  private async findMatchedDocuments(
    entityManager: EntityManager,
    workspaceId: string,
    query: string,
    limit: number,
  ): Promise<Array<{
    document: DocumentEntity;
    matchedText?: string;
  }>> {
    const tsQuery = this.buildPrefixTsQuery(query);

    if (!tsQuery) {
      return [];
    }

    const matches = await entityManager.getConnection().execute<Array<{
      id: string;
      title_match: boolean;
    }>>(
      `
        select
          d.id,
          (
            setweight(to_tsvector('simple', coalesce(d.title, '')), 'A')
            @@ to_tsquery('simple', ?)
          ) as title_match
        from documents d
        where
          d.workspace_id = ?
          and d.archived_at is null
          and d.search_vector @@ to_tsquery('simple', ?)
        order by
          title_match desc,
          ts_rank_cd(d.search_vector, to_tsquery('simple', ?)) desc,
          d.updated_at desc
        limit ?
      `,
      [tsQuery, workspaceId, tsQuery, tsQuery, limit],
    );

    if (matches.length === 0) {
      return [];
    }

    const documents = await entityManager.find(DocumentEntity, {
      id: {
        $in: matches.map((match) => match.id),
      },
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'updatedBy'],
    });
    const documentsById = new Map(documents.map((document) => [document.id, document]));

    return matches.flatMap((match) => {
      const document = documentsById.get(match.id);

      if (!document) {
        return [];
      }

      return [{
        document,
        matchedText: this.buildMatchedTextSnippet(document.searchText, query),
      }];
    });
  }

  private async buildBreadcrumbPath(
    document: DocumentEntity,
    entityManager: EntityManager,
    cache: Map<string, DocumentEntity | null>,
  ): Promise<string[]> {
    const breadcrumbPath: string[] = [];

    if (document.teamspace?.name) {
      breadcrumbPath.push(document.teamspace.name);
    }

    let parentDocumentId = document.parentDocument?.id;
    const ancestorTitles: string[] = [];

    while (parentDocumentId) {
      const ancestor = await this.findDocumentById(parentDocumentId, entityManager, cache);

      if (!ancestor) {
        break;
      }

      ancestorTitles.push(ancestor.title);
      parentDocumentId = ancestor.parentDocument?.id;
    }

    return [...breadcrumbPath, ...ancestorTitles.reverse()];
  }

  private async findDocumentById(
    documentId: string,
    entityManager: EntityManager,
    cache: Map<string, DocumentEntity | null>,
  ): Promise<DocumentEntity | null> {
    if (cache.has(documentId)) {
      return cache.get(documentId) ?? null;
    }

    const document = await entityManager.findOne(DocumentEntity, {
      id: documentId,
      archivedAt: null,
    }, {
      populate: ['parentDocument'],
    });

    cache.set(documentId, document ?? null);

    return document;
  }

  private buildMatchedTextSnippet(searchText: string, query: string): string | undefined {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery || !searchText) {
      return undefined;
    }

    const normalizedSearchText = searchText.toLowerCase();
    const matchIndex = normalizedSearchText.indexOf(normalizedQuery);

    if (matchIndex === -1) {
      return undefined;
    }

    return this.clipSnippet(searchText, matchIndex, normalizedQuery.length);
  }

  private clipSnippet(value: string, matchIndex: number, matchLength: number): string {
    const maxLength = 160;
    const preferredPrefix = 48;
    const preferredSuffix = maxLength - preferredPrefix - matchLength;
    const start = Math.max(0, matchIndex - preferredPrefix);
    const end = Math.min(value.length, matchIndex + matchLength + preferredSuffix);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < value.length ? '...' : '';

    return `${prefix}${value.slice(start, end).trim()}${suffix}`;
  }

  private buildPrefixTsQuery(query: string): string | undefined {
    const tokens = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.replace(/[':]/g, ' '))
      .flatMap((token) => token.split(/\s+/))
      .map((token) => token.replace(/[^a-z0-9_-]/g, ''))
      .filter(Boolean);

    if (tokens.length === 0) {
      return undefined;
    }

    return tokens.map((token) => `${token}:*`).join(' & ');
  }

  private hasMeaningfulContent(content: unknown[]): boolean {
    if (!Array.isArray(content) || content.length === 0) {
      return false;
    }

    if (content.length > 1) {
      return true;
    }

    const [firstBlock] = content;

    if (!firstBlock || typeof firstBlock !== 'object' || Array.isArray(firstBlock)) {
      return true;
    }

    const block = firstBlock as {
      type?: unknown;
      content?: unknown;
      children?: unknown;
      props?: unknown;
    };

    if (block.type !== 'paragraph') {
      return true;
    }

    if (Array.isArray(block.content) && block.content.length > 0) {
      return true;
    }

    if (Array.isArray(block.children) && block.children.length > 0) {
      return true;
    }

    if (
      block.props
      && typeof block.props === 'object'
      && !Array.isArray(block.props)
      && Object.values(block.props).some((value) => value !== undefined && value !== null && value !== '')
    ) {
      return true;
    }

    return false;
  }

  private async resolveWorkspaceForUser(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ) {
    const workspaces = await this.workspaceRepository.findAllForUser(currentUser.userId);
    const normalizedIdentifier = workspaceIdentifier.trim().toLowerCase();
    const workspace = workspaces.find((item) =>
      item.id === workspaceIdentifier || item.slug === normalizedIdentifier,
    );

    if (!workspace) {
      throw new SearchWorkspaceNotFoundError(workspaceIdentifier);
    }

    return workspace;
  }
}
