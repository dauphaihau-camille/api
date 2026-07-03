import { OptimisticLockError } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { AuditService } from '~/modules/shared/audit/audit.service';
import { canEditWorkspace } from '../../../workspace/app/workspace-permissions';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import {
  DocumentNotFoundError,
  DocumentPermissionDeniedError,
  DocumentVersionConflictError,
} from '../errors/document-app.error';
import { DocumentTreeService } from '../services/document-tree.service';
import type { DocumentSummary } from '../contracts/document.contract';
import { toDocumentSummary } from '../mappers/document-summary.mapper';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';

@Injectable()
export class ArchiveDocumentUseCase {
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
  ): Promise<DocumentSummary> {
    const document = await this.documentCommandRepository.findDocument(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }
    const workspace = await resolveWorkspaceForUser(this.workspaceRepository, document.workspace.id, currentUser);
    if (!canEditWorkspace(workspace.currentUserRole)) {
      throw new DocumentPermissionDeniedError();
    }

    try {
      await this.documentCommandRepository.lockDocumentVersion(document, version);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new DocumentVersionConflictError();
      }

      throw error;
    }

    const descendants = await this.documentTreeService.findDescendants(document.id, document.workspace.id);
    const archivedAt = new Date();
    const actor = await this.documentCommandRepository.findCurrentUser(currentUser.userId) as CurrentUserEntity;

    for (const item of [document, ...descendants]) {
      item.archivedAt = archivedAt;
      item.updatedBy = actor;
    }

    await this.documentCommandRepository.saveDocuments([document, ...descendants]);

    await this.auditService.record({
      action: 'document.archived',
      resourceType: 'document',
      resourceId: document.id,
      metadata: {
        workspaceId: workspace.id,
      },
    });

    return toDocumentSummary(document);
  }
}
