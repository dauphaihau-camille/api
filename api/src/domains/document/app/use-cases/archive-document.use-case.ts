import { OptimisticLockError } from '@mikro-orm/core';
import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { AuditService } from '~/integrations/audit/audit.service';
import { JobDispatcher } from '~/integrations/queue/app/ports/job-dispatcher';
import { appJobName } from '~/integrations/queue/app/app-job.types';
import { PublishRepository } from '../../../publish/app/ports/publish.repository';
import { canEditWorkspace } from '../../../workspace/app/workspace-permissions';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import {
  DocumentNotFoundError,
  DocumentPermissionDeniedError,
  DocumentVersionConflictError,
} from '../errors/document-app.error';
import { DocumentTreeService } from '../services/document-tree.service';
import { DocumentSubdocService } from '../services/document-subdoc.service';
import type { DocumentSummary } from '../contracts/document.contract';
import { toDocumentSummary } from '../mappers/document-summary.mapper';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';

@Injectable()
export class ArchiveDocumentUseCase {
  private static readonly TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
  private readonly logger = new Logger(ArchiveDocumentUseCase.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly jobDispatcher: JobDispatcher,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly publishRepository: PublishRepository,
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentTreeService: DocumentTreeService,
    private readonly documentSubdocService: DocumentSubdocService,
  ) {}

  async execute(
    documentId: string,
    version: number,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentSummary> {
    const existingDocument = await this.documentCommandRepository.findDocument(documentId);
    if (!existingDocument) {
      throw new DocumentNotFoundError(documentId);
    }
    const workspace = await resolveWorkspaceForUser(
      this.workspaceRepository,
      existingDocument.workspace.id,
      currentUser,
    );
    if (!canEditWorkspace(workspace.currentUserRole)) {
      throw new DocumentPermissionDeniedError();
    }

    try {
      await this.documentCommandRepository.lockDocumentVersion(existingDocument, version);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new DocumentVersionConflictError();
      }
      throw error;
    }

    const descendantIds = (
      await this.documentTreeService.findDescendants(existingDocument.id, existingDocument.workspace.id)
    ).map((document) => document.id);

    const archivedDocument = await this.documentCommandRepository.withTransaction(async ({
      commandRepository,
      subdocReferenceRepository,
    }) => {
      const document = await commandRepository.findDocument(documentId);
      if (!document) {
        throw new DocumentNotFoundError(documentId);
      }

      await commandRepository.lockDocumentVersion(document, version);

      const descendants = await Promise.all(
        descendantIds.map(async (descendantId) => {
          const descendant = await commandRepository.findDocument(descendantId);
          if (!descendant) {
            throw new DocumentNotFoundError(descendantId);
          }

          return descendant;
        }),
      );

      const archivedAt = new Date();

      for (const item of [document, ...descendants]) {
        item.archivedAt = archivedAt;
        commandRepository.assignUpdatedByUser(item, currentUser.userId);
      }

      await this.documentSubdocService.removeArchivedSubdocReferences(
        [document, ...descendants],
        subdocReferenceRepository,
      );
      await commandRepository.saveDocuments([document, ...descendants]);

      return document;
    });

    await this.publishRepository.unpublishDocument(archivedDocument.id);

    await this.auditService.record({
      action: 'document.archived',
      resourceType: 'document',
      resourceId: archivedDocument.id,
      metadata: {
        workspaceId: workspace.id,
      },
    });

    if (archivedDocument.archivedAt) {
      try {
        await this.jobDispatcher.dispatch(
          appJobName.permanentlyDeleteArchivedDocument,
          {
            documentId: archivedDocument.id,
            archivedAt: archivedDocument.archivedAt.toISOString(),
          },
          {
            deduplicationKey: `${appJobName.permanentlyDeleteArchivedDocument}:${archivedDocument.id}:${archivedDocument.archivedAt.toISOString()}`,
            delayMs: ArchiveDocumentUseCase.TRASH_RETENTION_MS,
          },
        );
      }
      catch (error) {
        this.logger.warn(
          `Archive cleanup enqueue failed for document ${archivedDocument.id}, continuing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return toDocumentSummary(archivedDocument);
  }
}
