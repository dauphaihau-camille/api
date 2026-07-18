import type { DocumentContentFormat } from './document.contract';

export interface CreateDocumentInput {
  workspaceId: string;
  teamspaceId?: string;
  title?: string;
  contentFormat?: DocumentContentFormat;
  content?: unknown[];
}

export interface UpdateDocumentInput {
  version: number;
  title?: string;
  contentFormat?: DocumentContentFormat;
  content?: unknown[];
}

export interface MoveDocumentInput {
  version: number;
  teamspaceId?: string | null;
  parentDocumentId?: string | null;
  index?: number;
}

export interface ListWorkspaceDocumentsInput {
  parentDocumentId?: string;
  limit: number;
  cursor?: string;
  query?: string;
}

export interface ListArchivedWorkspaceDocumentsInput {
  limit: number;
  cursor?: string;
  query?: string;
}
