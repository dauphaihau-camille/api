
export abstract class DocumentVisitRepository {
  abstract findRecentVisit(input: {
    workspaceId: string;
    userId: string;
  }): Promise<{ documentId: string } | null>;
  abstract recordVisit(input: {
    documentId: string;
    workspaceId: string;
    userId: string;
  }): Promise<void>;
}
