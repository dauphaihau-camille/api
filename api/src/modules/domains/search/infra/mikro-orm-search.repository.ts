import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { DocumentEntity } from '../../document/infra/persistence/entities/document.entity';
import { DocumentVisitEntity } from '../../document/infra/persistence/entities/document-visit.entity';
import {
  SearchRepository,
  type SearchMatchedDocumentRecord,
  type SearchVisitedDocumentRecord,
} from '../app/ports/search.repository';

@Injectable()
export class MikroOrmSearchRepository implements SearchRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findRecentVisitedDocuments(input: {
    workspaceId: string;
    userId: string;
    limit: number;
  }): Promise<SearchVisitedDocumentRecord[]> {
    const visits = await this.entityManager.fork().find(DocumentVisitEntity, {
      workspace: input.workspaceId,
      user: input.userId,
      document: {
        archivedAt: null,
      },
    }, {
      populate: ['document', 'document.workspace', 'document.teamspace', 'document.parentDocument', 'document.updatedBy'],
      orderBy: {
        lastVisitedAt: 'desc',
      },
      limit: input.limit,
    });

    return visits.map((visit) => ({
      document: visit.document,
      visitedAt: visit.lastVisitedAt,
    }));
  }

  async findMatchedDocuments(input: {
    workspaceId: string;
    query: string;
    limit: number;
  }): Promise<SearchMatchedDocumentRecord[]> {
    const tsQuery = this.buildPrefixTsQuery(input.query);

    if (!tsQuery) {
      return [];
    }

    const entityManager = this.entityManager.fork();
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
      [tsQuery, input.workspaceId, tsQuery, tsQuery, input.limit],
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
        matchedText: this.buildMatchedTextSnippet(document.searchText, input.query),
      }];
    });
  }

  async findAncestorTitles(parentDocumentId?: string): Promise<string[]> {
    if (!parentDocumentId) {
      return [];
    }

    const entityManager = this.entityManager.fork();
    const cache = new Map<string, DocumentEntity | null>();
    const ancestorTitles: string[] = [];
    let currentParentDocumentId: string | undefined = parentDocumentId;

    while (currentParentDocumentId) {
      const ancestor = await this.findDocumentById(currentParentDocumentId, entityManager, cache);

      if (!ancestor) {
        break;
      }

      ancestorTitles.push(ancestor.title);
      currentParentDocumentId = ancestor.parentDocument?.id;
    }

    return ancestorTitles.reverse();
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
}
