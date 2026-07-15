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
}

export interface FavoriteStatusSummary {
  documentId: string;
  isFavorite: boolean;
}
