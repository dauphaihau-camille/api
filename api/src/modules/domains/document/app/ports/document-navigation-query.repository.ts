import type { TeamspaceEntity } from '../../../teamspace/infra/persistence/entities/teamspace.entity';
import type { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import type { DocumentBreadcrumbItem } from '../contracts/document.contract';

export abstract class DocumentNavigationQueryRepository {
  abstract findDocument(
    documentIdentifier: string,
  ): Promise<DocumentEntity | null>;
  abstract findDocumentByIdInWorkspace(input: {
    documentId: string;
    workspaceId: string;
    archivedAt?: null;
  }): Promise<DocumentEntity | null>;
  abstract findTeamspaces(workspaceId: string): Promise<TeamspaceEntity[]>;
  abstract findRootDocuments(input: {
    workspaceId: string;
    teamspaceId?: string | null;
    parentDocumentId?: string | null;
    query?: string;
  }): Promise<DocumentEntity[]>;
  abstract findArchivedDocuments(input: {
    workspaceId: string;
    query?: string;
  }): Promise<DocumentEntity[]>;
  abstract findAncestors(parentDocumentId?: string): Promise<DocumentBreadcrumbItem[]>;
  abstract findChildren(input: {
    workspaceId: string;
    parentDocumentId: string;
  }): Promise<DocumentEntity[]>;
  abstract countActiveChildren(
    workspaceId: string,
    parentDocumentId: string,
  ): Promise<number>;
  abstract findFavoriteDocumentIds(input: {
    workspaceId: string;
    userId: string;
    documentIds: string[];
  }): Promise<string[]>;
}
