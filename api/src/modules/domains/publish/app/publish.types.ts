export interface PublishedDocumentSummary {
  documentId: string;
  publishedDocumentId?: string;
  publishedAt?: Date;
  publicPath?: string;
}

export interface PublicDocumentSummary {
  id: string;
  title: string;
  contentFormat: 'blocknote_v1';
  content: unknown[];
  publishedAt: Date;
  updatedAt: Date;
}
