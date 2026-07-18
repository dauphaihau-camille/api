import { OptimisticLockError } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { AuditService } from '~/integrations/audit/audit.service';
import { canEditWorkspace } from '../../../workspace/app/workspace-permissions';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentSummary } from '../contracts/document.contract';
import type { UpdateDocumentInput } from '../contracts/document.input';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { toDocumentSummary } from '../mappers/document-summary.mapper';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { extractDocumentSearchText } from '../utils/document-search-text.util';
import {
  DocumentNotFoundError,
  DocumentPermissionDeniedError,
  DocumentVersionConflictError,
} from '../errors/document-app.error';
import { normalizeContent } from '../utils/document-content.util';
import { normalizeTitle } from '../utils/document-title.util';
import { SyncDocumentSubdocReferencesUseCase } from './sync-document-subdoc-references.use-case';
import { SyncReferencedSubdocTitlesUseCase } from './sync-referenced-subdoc-titles.use-case';

@Injectable()
export class UpdateDocumentUseCase {
  constructor(
    private readonly auditService: AuditService,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly syncDocumentSubdocReferencesUseCase: SyncDocumentSubdocReferencesUseCase,
    private readonly syncReferencedSubdocTitlesUseCase: SyncReferencedSubdocTitlesUseCase,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
    input: UpdateDocumentInput,
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
      await this.documentCommandRepository.lockDocumentVersion(document, input.version);
    }
    catch (error) {
      if (error instanceof OptimisticLockError) {
        throw new DocumentVersionConflictError();
      }

      throw error;
    }

    if (input.title !== undefined) {
      document.title = normalizeTitle(input.title);
    }

    if (input.contentFormat !== undefined) {
      document.contentFormat = input.contentFormat;
    }

    if (input.content !== undefined) {
      document.contentJson = normalizeContent(input.content);
      document.searchText = extractDocumentSearchText(document.contentJson);
    }

    this.documentCommandRepository.assignUpdatedByUser(document, currentUser.userId);

    if (input.content !== undefined) {
      await this.syncDocumentSubdocReferencesUseCase.execute(document);
    }

    if (input.title !== undefined) {
      await this.syncReferencedSubdocTitlesUseCase.execute(document);
    }

    await this.documentCommandRepository.saveDocument(document);

    await this.auditService.record({
      action: 'document.updated',
      resourceType: 'document',
      resourceId: document.id,
      metadata: {
        workspaceId: workspace.id,
      },
    });

    return toDocumentSummary(document);
  }
}
