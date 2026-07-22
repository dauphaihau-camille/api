import type { TeamspaceAccessMode } from '../../../teamspace/domain/enums/teamspace-access-mode.enum';
import type { TeamspaceMemberRole } from '../../../teamspace/domain/enums/teamspace-member-role.enum';
import type { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';

export type DocumentCollaborationAccess = {
  content: unknown[];
  title: string;
  documentOwnerUserId: string;
  documentTeamspaceId?: string;
  teamspaceAccessMode?: TeamspaceAccessMode;
  teamspaceMemberRole?: TeamspaceMemberRole;
  workspaceId: string;
  workspaceRole: WorkspaceRole;
};

export type PersistedDocumentCollaborationState = {
  sequence: number;
  snapshot: Uint8Array;
  updates: Array<{
    sequence: number;
    update: Uint8Array;
  }>;
};

export abstract class DocumentCollaborationRepository {
  abstract getAccess(
    documentId: string,
    userId: string,
  ): Promise<DocumentCollaborationAccess | null>;

  abstract loadState(
    documentId: string,
  ): Promise<PersistedDocumentCollaborationState | null>;

  abstract initializeState(
    documentId: string,
    snapshot: Uint8Array,
  ): Promise<PersistedDocumentCollaborationState>;

  abstract replaceState(
    documentId: string,
    snapshot: Uint8Array,
  ): Promise<PersistedDocumentCollaborationState>;

  abstract appendUpdate(
    documentId: string,
    update: Uint8Array,
    updateHash: string,
  ): Promise<number>;

  abstract saveProjection(
    documentId: string,
    sequence: number,
    title: string,
    content: unknown[],
    referencedDocumentIds: string[],
    updatedByUserId: string,
  ): Promise<void>;

  abstract compactState(
    documentId: string,
    sequence: number,
    snapshot: Uint8Array,
  ): Promise<void>;
}
