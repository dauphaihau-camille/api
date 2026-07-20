import type { DocumentCommandTransaction } from './document-command.repository';

export abstract class DocumentCollaborationTransactionRunner {
  abstract run<T>(
    callback: (repositories: DocumentCommandTransaction) => Promise<T>,
  ): Promise<T>;
}
