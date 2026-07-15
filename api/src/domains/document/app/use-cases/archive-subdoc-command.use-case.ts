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
import type { ArchiveSubdocCommandResult } from '../contracts/document.contract';
import { toDocumentSummary } from '../mappers/document-summary.mapper';
import { DocumentSubdocService } from '../services/document-subdoc.service';
import { DocumentTreeService } from '../services/document-tree.service';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { extractDocumentSearchText } from '../utils/document-search-text.util';
import { normalizeContent } from '../utils/document-content.util';

@Injectable()
export class ArchiveSubdocCommandUseCase {
  private static readonly TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
  private readonly logger = new Logger(ArchiveSubdocCommandUseCase.name);

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
    currentUser: AuthenticatedUser,
    parentDocumentId: string,
    input: {
      subdocumentId: string;
      version: number;
      content?: unknown[];
    },
  ): Promise<ArchiveSubdocCommandResult> {
    const existingParentDocument = await this.documentCommandRepository.findDocument(parentDocumentId);

    if (!existingParentDocument) {
      throw new DocumentNotFoundError(parentDocumentId);
    }

    const workspace = await resolveWorkspaceForUser(
      this.workspaceRepository,
      existingParentDocument.workspace.id,
      currentUser,
    );

    if (!canEditWorkspace(workspace.currentUserRole)) {
      throw new DocumentPermissionDeniedError();
    }

    try {
      await this.documentCommandRepository.lockDocumentVersion(existingParentDocument, input.version);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new DocumentVersionConflictError();
      }

      throw error;
    }

    const existingSubdocument = await this.documentCommandRepository.findDocument(
      input.subdocumentId,
    );

    if (
      !existingSubdocument
      || existingSubdocument.workspace.id !== existingParentDocument.workspace.id
      || existingSubdocument.parentDocument?.id !== existingParentDocument.id
    ) {
      throw new DocumentNotFoundError(input.subdocumentId);
    }

    const descendantIds = (
      await this.documentTreeService.findDescendants(
        existingSubdocument.id,
        existingParentDocument.workspace.id,
      )
    ).map((document) => document.id);

    const { archivedSubdocument, updatedParentDocument } =
      await this.documentCommandRepository.withTransaction(async ({
        commandRepository,
        subdocReferenceRepository,
      }) => {
        const transactionalParentDocument = await commandRepository.findDocument(
          existingParentDocument.id,
        );

        if (!transactionalParentDocument) {
          throw new DocumentNotFoundError(existingParentDocument.id);
        }

        await commandRepository.lockDocumentVersion(
          transactionalParentDocument,
          input.version,
        );

        const transactionalSubdocument = await commandRepository.findDocument(
          existingSubdocument.id,
        );

        if (
          !transactionalSubdocument
          || transactionalSubdocument.parentDocument?.id !== transactionalParentDocument.id
        ) {
          throw new DocumentNotFoundError(existingSubdocument.id);
        }

        const descendants = await Promise.all(
          descendantIds.map(async (descendantId) => {
            const descendant = await commandRepository.findDocument(descendantId);

            if (!descendant) {
              throw new DocumentNotFoundError(descendantId);
            }

            return descendant;
          }),
        );

        const archivedDocuments = [transactionalSubdocument, ...descendants];
        const archivedDocumentIds = new Set(
          archivedDocuments.map((document) => document.id),
        );
        const archivedAt = new Date();

        for (const document of archivedDocuments) {
          document.archivedAt = archivedAt;
          commandRepository.assignUpdatedByUser(document, currentUser.userId);
        }

        const parentContent = input.content !== undefined
          ? normalizeContent(input.content)
          : transactionalParentDocument.contentJson;
        const normalizedParentContent = this.documentSubdocService
          .removeSubdocBlocksFromContent(parentContent, archivedDocumentIds).content;

        transactionalParentDocument.contentJson = normalizedParentContent;
        transactionalParentDocument.searchText = extractDocumentSearchText(
          normalizedParentContent,
        );
        commandRepository.assignUpdatedByUser(
          transactionalParentDocument,
          currentUser.userId,
        );

        await this.documentSubdocService.removeArchivedSubdocReferences(
          archivedDocuments,
          subdocReferenceRepository,
        );
        await this.documentSubdocService.syncSubdocReferencesForDoc(
          transactionalParentDocument,
          subdocReferenceRepository,
        );
        await commandRepository.saveDocuments([
          transactionalParentDocument,
          ...archivedDocuments,
        ]);
        await commandRepository.flush();

        return {
          archivedSubdocument: transactionalSubdocument,
          updatedParentDocument: transactionalParentDocument,
        };
      });

    await this.publishRepository.unpublishDocument(archivedSubdocument.id);

    await this.auditService.record({
      action: 'document.archived',
      resourceType: 'document',
      resourceId: archivedSubdocument.id,
      metadata: {
        workspaceId: workspace.id,
        parentDocumentId: updatedParentDocument.id,
        command: 'archive-subdoc',
      },
    });

    if (archivedSubdocument.archivedAt) {
      try {
        await this.jobDispatcher.dispatch(
          appJobName.permanentlyDeleteArchivedDocument,
          {
            documentId: archivedSubdocument.id,
            archivedAt: archivedSubdocument.archivedAt.toISOString(),
          },
          {
            deduplicationKey: `${appJobName.permanentlyDeleteArchivedDocument}:${archivedSubdocument.id}:${archivedSubdocument.archivedAt.toISOString()}`,
            delayMs: ArchiveSubdocCommandUseCase.TRASH_RETENTION_MS,
          },
        );
      }
      catch (error) {
        this.logger.warn(
          `Archive cleanup enqueue failed for subdocument ${archivedSubdocument.id}, continuing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return {
      parentDocument: toDocumentSummary(updatedParentDocument),
      archivedChildDocument: toDocumentSummary(archivedSubdocument),
    };
  }
}
