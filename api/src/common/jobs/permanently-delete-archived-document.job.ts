import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import type { AppJobPayloadMap } from './job.types';
import { DocumentEntity } from '../../modules/domains/document/infra/persistence/entities/document.entity';

type PermanentlyDeleteArchivedDocumentPayload =
  AppJobPayloadMap['document.permanently-delete-archived'];

@Injectable()
export class PermanentlyDeleteArchivedDocumentJob {
  private readonly logger = new Logger(PermanentlyDeleteArchivedDocumentJob.name);

  constructor(private readonly entityManager: EntityManager) {}

  async run(payload: PermanentlyDeleteArchivedDocumentPayload): Promise<void> {
    const entityManager = this.entityManager.fork();
    const rootDocument = await entityManager.findOne(DocumentEntity, {
      id: payload.documentId,
    }, {
      populate: ['workspace'],
    });

    if (!rootDocument || !rootDocument.archivedAt) {
      return;
    }

    if (rootDocument.archivedAt.toISOString() !== payload.archivedAt) {
      return;
    }

    const subtree = [rootDocument];
    let parentDocumentIds = [rootDocument.id];

    while (parentDocumentIds.length > 0) {
      const children = await entityManager.find(DocumentEntity, {
        workspace: rootDocument.workspace.id,
        parentDocument: { $in: parentDocumentIds },
      });

      if (children.length === 0) {
        break;
      }

      subtree.push(...children);
      parentDocumentIds = children.map((document) => document.id);
    }

    await entityManager.remove(subtree).flush();

    this.logger.log(
      `Permanently deleted archived document subtree rooted at ${payload.documentId}`,
    );
  }
}
