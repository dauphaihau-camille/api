import type { DocumentAccessGrantPermission } from '../../domain/enums/document-access-grant-permission.enum';

export type DocumentInvitationSummary = {
  id: string;
  documentId: string;
  workspaceId: string;
  email: string;
  permission: DocumentAccessGrantPermission;
  invitedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export abstract class DocumentInvitationRepository {
  abstract upsertInvitation(input: {
    workspaceId: string;
    documentId: string;
    email: string;
    permission: DocumentAccessGrantPermission;
    invitedByUserId: string;
  }): Promise<DocumentInvitationSummary>;

  abstract listActiveInvitations(documentId: string): Promise<DocumentInvitationSummary[]>;

  abstract listActiveInvitationsForEmail(email: string): Promise<DocumentInvitationSummary[]>;

  abstract markInvitationAccepted(input: {
    invitationId: string;
    userId: string;
  }): Promise<void>;

  abstract updateInvitationPermission(input: {
    documentId: string;
    invitationId: string;
    permission: DocumentAccessGrantPermission;
  }): Promise<DocumentInvitationSummary | null>;

  abstract revokeInvitation(input: {
    documentId: string;
    invitationId: string;
  }): Promise<DocumentInvitationSummary | null>;
}
