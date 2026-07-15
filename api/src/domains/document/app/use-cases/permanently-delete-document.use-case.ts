import { OptimisticLockError } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { AuditService } from '~/integrations/audit/audit.service';
import { canEditWorkspace } from '../../../workspace/app/workspace-permissions';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import {
  DocumentNotArchivedError,
  DocumentNotFoundError,
  DocumentPermissionDeniedError,
  DocumentVersionConflictError,
} from '../errors/document-app.error';
import { DocumentTreeService } from '../services/document-tree.service';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';

@Injectable()
export class PermanentlyDeleteDocumentUseCase {
  constructor(
    private readonly auditService: AuditService,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentTreeService: DocumentTreeService,
  ) {}

  async execute(
    documentId: string,
    version: number,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    const existingDocument = await this.documentCommandRepository.findDocument(documentId);
    if (!existingDocument) {
      throw new DocumentNotFoundError(documentId);
    }
    if (!existingDocument.archivedAt) {
      throw new DocumentNotArchivedError();
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

    await this.documentCommandRepository.withTransaction(async ({ commandRepository }) => {
      const document = await commandRepository.findDocument(documentId);
      if (!document) {
        throw new DocumentNotFoundError(documentId);
      }
      if (!document.archivedAt) {
        throw new DocumentNotArchivedError();
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

      await commandRepository.removeDocuments([document, ...descendants]);
    });

    await this.auditService.record({
      action: 'document.permanently_deleted',
      resourceType: 'document',
      resourceId: existingDocument.id,
      metadata: {
        workspaceId: workspace.id,
      },
    });
  }
}
