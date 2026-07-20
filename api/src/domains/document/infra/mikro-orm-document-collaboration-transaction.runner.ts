import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { DocumentCommandTransaction } from '../app/ports/document-command.repository';
import { DocumentCollaborationTransactionRunner } from '../app/ports/document-collaboration-transaction-runner';
import { DocumentSubdocContentService } from '../app/services/document-subdoc-content.service';
import { MikroOrmDocumentCollaborationRepository } from './mikro-orm-document-collaboration.repository';
import { MikroOrmDocumentCommandRepository } from './mikro-orm-document-command.repository';
import { MikroOrmDocumentSubdocReferenceRepository } from './mikro-orm-document-subdoc-reference.repository';

@Injectable()
export class MikroOrmDocumentCollaborationTransactionRunner
implements DocumentCollaborationTransactionRunner {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly documentSubdocContentService: DocumentSubdocContentService,
  ) {}

  run<T>(
    callback: (repositories: DocumentCommandTransaction) => Promise<T>,
  ): Promise<T> {
    return this.entityManager.transactional(async (transactionalEntityManager) =>
      callback({
        commandRepository: new MikroOrmDocumentCommandRepository(
          transactionalEntityManager,
          this.documentSubdocContentService,
        ),
        collaborationRepository: new MikroOrmDocumentCollaborationRepository(
          transactionalEntityManager,
        ),
        subdocReferenceRepository: new MikroOrmDocumentSubdocReferenceRepository(
          transactionalEntityManager,
        ),
      }));
  }
}
