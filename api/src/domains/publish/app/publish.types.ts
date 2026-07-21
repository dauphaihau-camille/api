export interface PublishedDocumentSummary {
  documentId: string;
  publishedDocumentId?: string;
  publishedAt?: Date;
  publicPath?: string;
}

export interface PublishableDocument {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  teamspaceId?: string;
}

export interface PublishedDocumentRecord {
  id: string;
  documentId: string;
  archivedAt?: Date | null;
  createdAt: Date;
}

export interface PublicBreadcrumbItem {
  id: string;
  title: string;
  publishedDocumentId: string;
  publicPath: string;
}

export interface PublicDocumentSummary {
  id: string;
  publishedDocumentId: string;
  title: string;
  contentFormat: 'blocknote_v1';
  content: unknown[];
  breadcrumb: PublicBreadcrumbItem[];
  publishedAt: Date;
  updatedAt: Date;
}
