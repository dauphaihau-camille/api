import type { DocumentEntity } from '../../infra/persistence/entities/document.entity';

export abstract class DocumentVisitRepository {
  abstract findRecentVisit(input: {
    workspaceId: string;
    userId: string;
  }): Promise<{ document: DocumentEntity } | null>;
  abstract recordVisit(document: DocumentEntity, userId: string): Promise<void>;
}
