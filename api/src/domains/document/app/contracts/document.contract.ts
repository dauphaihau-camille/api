export type DocumentContentFormat = 'blocknote_v1';

export interface DocumentBreadcrumbItem {
  id: string;
  publicId: string;
  title: string;
}

export interface DocumentAccessSummary {
  scope: 'private' | 'shared' | 'teamspace';
  permission: 'none' | 'view' | 'edit' | 'manage';
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
  workspaceMemberPermission?: 'view' | 'comment' | 'edit' | 'manage';
}

export interface DocumentCollaborationSummary {
  enabled: boolean;
  mode: 'edit' | 'view';
  showPresence: boolean;
}

export interface DocumentOwnerUserSummary {
  id: string;
  email: string;
  displayName?: string;
}

export interface DocumentTeamspaceRef {
  id: string;
  name: string;
  description?: string;
}

export interface DocumentSummary {
  id: string;
  publicId: string;
  version: number;
  workspaceId: string;
  ownerUserId: string;
  ownerUser: DocumentOwnerUserSummary;
  teamspaceId?: string;
  parentDocumentId?: string;
  title: string;
  contentFormat: DocumentContentFormat;
  content: unknown[];
  sortKey: number;
  archivedAt?: Date;
  archivedByName?: string;
  createdAt: Date;
  updatedAt: Date;
  isFavorite?: boolean;
  publishedDocumentId?: string;
  publicPath?: string;
  breadcrumb?: DocumentBreadcrumbItem[];
  access?: DocumentAccessSummary;
  collaboration?: DocumentCollaborationSummary;
}

export interface CreateSubdocCommandResult {
  parentDocument: DocumentSummary;
  childDocument: DocumentSummary;
}

export interface ArchiveSubdocCommandResult {
  parentDocument: DocumentSummary;
  archivedChildDocument: DocumentSummary;
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
  isFavorite: boolean;
}

export interface DocumentNavigationNode {
  id: string;
  publicId: string;
  accessScope?: 'private' | 'shared' | 'teamspace';
  isOwnedByCurrentUser: boolean;
  title: string;
  teamspaceId?: string;
  parentDocumentId?: string;
  sortKey: number;
  hasChildren: boolean;
  hasContent: boolean;
  isFavorite: boolean;
}

export interface DocumentNavigationPage {
  items: DocumentNavigationNode[];
  nextCursor?: string;
}

export interface ArchivedDocumentListItem {
  id: string;
  publicId: string;
  version: number;
  title: string;
  hasContent: boolean;
  breadcrumbPath: string[];
  archivedAt: Date;
}

export interface ArchivedDocumentListPage {
  items: ArchivedDocumentListItem[];
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
  sharedDocuments: DocumentNavigationPage;
  teamspaces: TeamspaceDocumentNavigationGroup[];
}

export interface WorkspaceDefaultDocument {
  documentId?: string;
}
