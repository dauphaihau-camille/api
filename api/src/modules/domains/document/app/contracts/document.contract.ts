export type DocumentContentFormat = 'blocknote_v1';

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
