import type { DocumentEntity } from '../../../document/infra/persistence/entities/document.entity';
import type { TeamspaceMemberRole } from '../../../teamspace/domain/enums/teamspace-member-role.enum';

export type SearchVisitedDocumentRecord = {
  document: DocumentEntity;
  teamspaceMemberRole?: TeamspaceMemberRole;
  visitedAt: Date;
};

export type SearchMatchedDocumentRecord = {
  document: DocumentEntity;
  matchedText?: string;
  teamspaceMemberRole?: TeamspaceMemberRole;
};

export abstract class SearchRepository {
  abstract findRecentVisitedDocuments(input: {
    workspaceId: string;
    userId: string;
    limit: number;
  }): Promise<SearchVisitedDocumentRecord[]>;

  abstract findMatchedDocuments(input: {
    workspaceId: string;
    userId: string;
    query: string;
    limit: number;
  }): Promise<SearchMatchedDocumentRecord[]>;

  abstract findAncestorTitles(parentDocumentId?: string): Promise<string[]>;
}
