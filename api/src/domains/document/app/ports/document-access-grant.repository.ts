import type { DocumentAccessGrantPermission } from '../../domain/enums/document-access-grant-permission.enum';

export type DocumentAccessGrantUserSummary = {
  id: string;
  email: string;
  displayName?: string;
};

export type DocumentAccessGrantSummary = {
  id: string;
  documentId: string;
  user: DocumentAccessGrantUserSummary;
  permission: DocumentAccessGrantPermission;
  grantedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InheritedDocumentAccessGrantSummary = DocumentAccessGrantSummary & {
  inheritedFromDocument: {
    id: string;
    title: string;
  };
};

export abstract class DocumentAccessGrantRepository {
  abstract findActiveGrant(input: {
    documentId: string;
    userId: string;
  }): Promise<DocumentAccessGrantSummary | null>;

  abstract findStrongestActiveGrantInAncestors(input: {
    documentId: string;
    userId: string;
  }): Promise<DocumentAccessGrantSummary | null>;

  abstract findActiveGrantPermissionsByDocumentId(input: {
    documentIds: string[];
    userId: string;
  }): Promise<Map<string, DocumentAccessGrantPermission>>;

  abstract findStrongestActiveGrantPermissionsInAncestorsByDocumentId(input: {
    documentIds: string[];
    userId: string;
  }): Promise<Map<string, DocumentAccessGrantPermission>>;

  abstract hasActiveGrants(documentId: string): Promise<boolean>;

  abstract hasActiveGrantsIncludingAncestors(documentId: string): Promise<boolean>;

  abstract findDocumentIdsWithActiveGrantsIncludingAncestors(
    documentIds: string[],
  ): Promise<Set<string>>;

  abstract findWorkspaceUser(input: {
    workspaceId: string;
    userId: string;
  }): Promise<DocumentAccessGrantUserSummary | null>;

  abstract upsertGrant(input: {
    workspaceId: string;
    documentId: string;
    userId: string;
    permission: DocumentAccessGrantPermission;
    grantedByUserId: string;
  }): Promise<DocumentAccessGrantSummary>;

  abstract revokeGrant(input: {
    documentId: string;
    userId: string;
  }): Promise<DocumentAccessGrantSummary | null>;

  abstract listActiveGrants(documentId: string): Promise<DocumentAccessGrantSummary[]>;

  abstract listStrongestActiveGrantsInAncestors(
    documentId: string,
  ): Promise<InheritedDocumentAccessGrantSummary[]>;
}
