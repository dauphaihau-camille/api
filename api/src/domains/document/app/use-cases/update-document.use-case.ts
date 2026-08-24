import { OptimisticLockError } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { BlockCreationGateService } from '~/domains/subscription/app/services/block-creation-gate.service';
import { AuditService } from '~/integrations/audit/audit.service';
import type { DocumentSummary } from '../contracts/document.contract';
import type { UpdateDocumentInput } from '../contracts/document.input';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentCollaborationRepository } from '../ports/document-collaboration.repository';
import { toDocumentSummary } from '../mappers/document-summary.mapper';
import { extractDocumentSearchText } from '../utils/document-search-text.util';
import {
  DocumentNotFoundError,
  DocumentContentManagedByCollaborationError,
  DocumentVersionConflictError,
} from '../errors/document-app.error';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';
import { countContentBlocks, normalizeContent } from '../utils/document-content.util';
import { normalizeTitle } from '../utils/document-title.util';
import { SyncDocumentSubdocReferencesUseCase } from './sync-document-subdoc-references.use-case';
import { SyncReferencedSubdocTitlesUseCase } from './sync-referenced-subdoc-titles.use-case';

@Injectable()
export class UpdateDocumentUseCase {
  constructor(
    private readonly auditService: AuditService,
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentCollaborationRepository: DocumentCollaborationRepository,
    private readonly documentAccessCapabilityService: DocumentAccessCapabilityService,
    private readonly syncDocumentSubdocReferencesUseCase: SyncDocumentSubdocReferencesUseCase,
    private readonly syncReferencedSubdocTitlesUseCase: SyncReferencedSubdocTitlesUseCase,
    private readonly blockCreationGateService: BlockCreationGateService,
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
    const { workspace } = await this.documentAccessCapabilityService.assertCanEdit(document, currentUser);

    if (
      input.content !== undefined
      && await this.documentCollaborationRepository.loadState(document.id)
    ) {
      throw new DocumentContentManagedByCollaborationError();
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
      const previousBlockCount = countContentBlocks(document.contentJson);
      const nextContent = normalizeContent(input.content);
      const nextBlockCount = countContentBlocks(nextContent);

      await this.blockCreationGateService.assertCanCreateBlocks({
        workspaceId: workspace.id,
        newBlockCount: Math.max(0, nextBlockCount - previousBlockCount),
      });

      document.contentJson = nextContent;
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
