export interface SearchDocumentSummary {
  documentId: string;
  publicId: string;
  workspaceId: string;
  teamspaceId?: string;
  parentDocumentId?: string;
  title: string;
  hasContent: boolean;
  breadcrumbPath: string[];
  updatedByName?: string;
  matchedText?: string;
  updatedAt: Date;
  visitedAt?: Date;
}
