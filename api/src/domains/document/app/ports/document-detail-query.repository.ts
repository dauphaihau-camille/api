import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import type { DocumentSummary } from '../contracts/document.contract';

export abstract class DocumentDetailQueryRepository {
  abstract findDocumentDetail(input: {
    documentId: string;
    currentUser: AuthenticatedUser;
  }): Promise<DocumentSummary | null>;
}
