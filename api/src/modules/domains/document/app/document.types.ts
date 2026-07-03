export type DocumentContentFormat = 'blocknote_v1';

export const DOCUMENT_LIST_DEFAULT_LIMIT = 50;
export const DOCUMENT_LIST_MAX_LIMIT = 100;

export interface DocumentSummary {
  id: string;
  publicId: string;
  version: number;
  workspaceId: string;
  teamspaceId?: string;
  parentDocumentId?: string;
  title: string;
  contentFormat: DocumentContentFormat;
  content: unknown[];
  sortKey: number;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentTreeChild {
  id: string;
  publicId: string;
  title: string;
  teamspaceId?: string;
  parentDocumentId?: string;
  sortKey: number;
  hasChildren: boolean;
  hasContent: boolean;
}

export interface DocumentNavigationNode {
  id: string;
  publicId: string;
  title: string;
  teamspaceId?: string;
  parentDocumentId?: string;
  sortKey: number;
  hasChildren: boolean;
  hasContent: boolean;
}

export interface DocumentNavigationPage {
  items: DocumentNavigationNode[];
  nextCursor?: string;
}

export interface TeamspaceDocumentNavigationGroup {
  id: string;
  name: string;
  description?: string;
  documents: DocumentNavigationPage;
}

export interface WorkspaceDocumentNavigation {
  privateDocuments: DocumentNavigationPage;
  teamspaces: TeamspaceDocumentNavigationGroup[];
}

export interface WorkspaceDefaultDocument {
  documentId?: string;
}

export interface CreateDocumentInput {
  workspaceId: string;
  teamspaceId?: string;
  parentDocumentId?: string;
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
