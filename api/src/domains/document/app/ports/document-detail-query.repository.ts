import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import type { DocumentSummary } from '../contracts/document.contract';

export type AiSourceDocument = Pick<DocumentSummary, 'id' | 'workspaceId' | 'title' | 'content'>;

export abstract class DocumentDetailQueryRepository {
  abstract findDocumentDetail(input: {
    documentId: string;
    currentUser: AuthenticatedUser;
  }): Promise<DocumentSummary | null>;

  abstract findDocumentDetailsForAiSource(input: {
    documentIds: string[];
    currentUser: AuthenticatedUser;
  }): Promise<AiSourceDocument[]>;
}
