export type FavoriteDocumentPermission = 'view' | 'edit' | 'manage';

export interface FavoriteDocumentAccessSummary {
  permission: FavoriteDocumentPermission;
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
}

export interface FavoriteDocumentSummary {
  documentId: string;
  publicId: string;
  workspaceId: string;
  teamspaceId?: string;
  parentDocumentId?: string;
  title: string;
  sortKey: number;
  hasChildren: boolean;
  hasContent: boolean;
  favoritedAt: Date;
  access: FavoriteDocumentAccessSummary;
}

export interface FavoriteStatusSummary {
  documentId: string;
  isFavorite: boolean;
}
