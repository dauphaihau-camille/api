import { OptimisticLockError } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { AuditService } from '~/integrations/audit/audit.service';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import { DEFAULT_CONTENT_FORMAT } from '../constants/document.constants';
import type { CreateSubdocCommandResult } from '../contracts/document.contract';
import { toDocumentSummary } from '../mappers/document-summary.mapper';
import { extractDocumentSearchText } from '../utils/document-search-text.util';
import { normalizeContent } from '../utils/document-content.util';
import { DocumentSubdocContentService } from '../services/document-subdoc-content.service';
import { DocumentTreeService } from '../services/document-tree.service';
import {
  DocumentNotFoundError,
  ParentDocumentWorkspaceMismatchError,
  DocumentVersionConflictError,
} from '../errors/document-app.error';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { SyncDocumentSubdocReferencesUseCase } from './sync-document-subdoc-references.use-case';

@Injectable()
export class CreateSubdocCommandUseCase {
  constructor(
    private readonly auditService: AuditService,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentNavigationQueryRepository: DocumentNavigationQueryRepository,
    private readonly documentSubdocContentService: DocumentSubdocContentService,
    private readonly syncDocumentSubdocReferencesUseCase: SyncDocumentSubdocReferencesUseCase,
    private readonly documentTreeService: DocumentTreeService,
  ) {}

  async execute(
    currentUser: AuthenticatedUser,
    parentDocumentId: string,
    input: {
      anchorBlockId?: string;
      slashCommandText?: string;
      version?: number;
      content?: unknown[];
    } = {},
  ): Promise<CreateSubdocCommandResult> {
    const parentDocument = await this.documentNavigationQueryRepository.findDocument(parentDocumentId);

    if (!parentDocument) {
      throw new DocumentNotFoundError(parentDocumentId);
    }

    const workspace = await resolveWorkspaceForUser(
      this.workspaceRepository,
      parentDocument.workspace.id,
      currentUser,
    );

    if (parentDocument.workspace.id !== workspace.id) {
      throw new ParentDocumentWorkspaceMismatchError();
    }

    const { childDocument, updatedParentDocument } =
      await this.documentCommandRepository.withTransaction(async ({
        commandRepository,
        subdocReferenceRepository,
      }) => {
        const transactionalParentDocument = await commandRepository.findDocument(parentDocument.id);

        if (!transactionalParentDocument) {
          throw new DocumentNotFoundError(parentDocument.id);
        }

        if (input.version !== undefined) {
          try {
            await commandRepository.lockDocumentVersion(
              transactionalParentDocument,
              input.version,
            );
          }
          catch (error) {
            if (error instanceof OptimisticLockError) {
              throw new DocumentVersionConflictError();
            }

            throw error;
          }
        }

        const createdDocument = commandRepository.createDocument({
          workspaceId: workspace.id,
          teamspaceId: transactionalParentDocument.teamspace?.id,
          parentDocumentId: transactionalParentDocument.id,
          title: 'Untitled',
          contentFormat: DEFAULT_CONTENT_FORMAT,
          contentJson: normalizeContent(),
          searchText: '',
          sortKey: await this.documentTreeService.resolveSortKeyForCreate(
            workspace.id,
            transactionalParentDocument.id,
            transactionalParentDocument.teamspace?.id,
          ),
          createdByUserId: currentUser.userId,
          ownerUserId: currentUser.userId,
          updatedByUserId: currentUser.userId,
        });

        const parentContent = input.content !== undefined
          ? normalizeContent(input.content)
          : transactionalParentDocument.contentJson;

        transactionalParentDocument.contentJson = this.documentSubdocContentService.insertSubdocBlock(
          parentContent,
          createdDocument,
          input.anchorBlockId,
          input.slashCommandText,
        );
        transactionalParentDocument.searchText = extractDocumentSearchText(
          transactionalParentDocument.contentJson,
        );
        commandRepository.assignUpdatedByUser(
          transactionalParentDocument,
          currentUser.userId,
        );

        await commandRepository.saveDocuments([
          createdDocument,
          transactionalParentDocument,
        ]);
        await this.syncDocumentSubdocReferencesUseCase.execute(
          createdDocument,
          subdocReferenceRepository,
        );
        await this.syncDocumentSubdocReferencesUseCase.execute(
          transactionalParentDocument,
          subdocReferenceRepository,
        );
        await commandRepository.flush();

        return {
          childDocument: createdDocument,
          updatedParentDocument: transactionalParentDocument,
        };
      });

    await this.auditService.record({
      action: 'document.created',
      resourceType: 'document',
      resourceId: childDocument.id,
      metadata: {
        workspaceId: workspace.id,
        teamspaceId: updatedParentDocument.teamspace?.id,
        parentDocumentId: updatedParentDocument.id,
        command: 'create-subdoc',
      },
    });

    return {
      parentDocument: toDocumentSummary(updatedParentDocument),
      childDocument: toDocumentSummary(childDocument),
    };
  }
}
