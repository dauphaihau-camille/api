import type { DocumentEntity } from '../../../document/infra/persistence/entities/document.entity';

export type SearchVisitedDocumentRecord = {
  document: DocumentEntity;
  visitedAt: Date;
};

export type SearchMatchedDocumentRecord = {
  document: DocumentEntity;
  matchedText?: string;
};

export abstract class SearchRepository {
  abstract findRecentVisitedDocuments(input: {
    workspaceId: string;
    userId: string;
    limit: number;
  }): Promise<SearchVisitedDocumentRecord[]>;

  abstract findMatchedDocuments(input: {
    workspaceId: string;
    query: string;
    limit: number;
  }): Promise<SearchMatchedDocumentRecord[]>;

  abstract findAncestorTitles(parentDocumentId?: string): Promise<string[]>;
}
