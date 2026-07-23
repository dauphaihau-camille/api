import type { DocumentAccessGrantPermission } from '../../domain/enums/document-access-grant-permission.enum';

export type DocumentAccessSettingSummary = {
  documentId: string;
  workspaceMemberPermission?: DocumentAccessGrantPermission;
  updatedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export abstract class DocumentAccessSettingRepository {
  abstract findByDocumentId(documentId: string): Promise<DocumentAccessSettingSummary | null>;

  abstract findWorkspaceMemberPermissionsByDocumentId(input: {
    documentIds: string[];
  }): Promise<Map<string, DocumentAccessGrantPermission>>;

  abstract upsertWorkspaceMemberPermission(input: {
    workspaceId: string;
    documentId: string;
    permission?: DocumentAccessGrantPermission;
    updatedByUserId: string;
  }): Promise<DocumentAccessSettingSummary>;
}
