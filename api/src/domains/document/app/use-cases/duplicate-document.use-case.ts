import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { AuditService } from '~/integrations/audit/audit.service';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentSummary } from '../contracts/document.contract';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { toDocumentSummary } from '../mappers/document-summary.mapper';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { DocumentAccessResolver } from '../policies/document-access.resolver';
import {
  ArchivedDocumentDuplicationError,
  DocumentDuplicationInvariantError,
  DocumentNotFoundError,
  DocumentPermissionDeniedError,
} from '../errors/document-app.error';
import { DocumentSubdocContentService } from '../services/document-subdoc-content.service';
import { DocumentTreeService } from '../services/document-tree.service';
import { extractDocumentSearchText } from '../utils/document-search-text.util';
import { SyncDocumentSubdocReferencesUseCase } from './sync-document-subdoc-references.use-case';

@Injectable()
export class DuplicateDocumentUseCase {
  constructor(
    private readonly auditService: AuditService,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentAccessResolver: DocumentAccessResolver,
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentSubdocContentService: DocumentSubdocContentService,
    private readonly syncDocumentSubdocReferencesUseCase: SyncDocumentSubdocReferencesUseCase,
    private readonly documentTreeService: DocumentTreeService,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentSummary> {
    const sourceDocument = await this.documentCommandRepository.findDocument(documentId);
    if (!sourceDocument) {
      throw new DocumentNotFoundError(documentId);
    }
    const workspace = await resolveWorkspaceForUser(this.workspaceRepository, sourceDocument.workspace.id, currentUser);
    if (!this.documentAccessResolver.resolve(workspace.currentUserRole).canEdit) {
      throw new DocumentPermissionDeniedError();
    }

    if (sourceDocument.archivedAt) {
      throw new ArchivedDocumentDuplicationError();
    }

    const sourceSubtree = await this.documentTreeService.findActiveSubtreeDocuments(
      sourceDocument.id,
      sourceDocument.workspace.id,
    );
    if (!sourceSubtree) {
      throw new DocumentNotFoundError(sourceDocument.id);
    }
    const sourceRootDocument = sourceSubtree[0];
    if (!sourceRootDocument) {
      throw new DocumentDuplicationInvariantError(
        `missing subtree root for source document ${sourceDocument.id}`,
      );
    }

    const {
      duplicatedRootDocument,
      duplicatedDocuments,
      originalDocumentByDuplicateId,
    } = await this.documentCommandRepository.withTransaction(async ({
      commandRepository,
      subdocReferenceRepository,
    }) => {
      const duplicatedDocumentByOriginalId = new Map<string, DocumentEntity>();
      const duplicatedDocumentEntities: DocumentEntity[] = [];

      for (const originalDocument of sourceSubtree) {
        const duplicatedParentDocument = originalDocument.id === sourceDocument.id
          ? sourceRootDocument.parentDocument
          : duplicatedDocumentByOriginalId.get(originalDocument.parentDocument?.id ?? '');

        const duplicatedDocument = commandRepository.createDocument({
          workspaceId: originalDocument.workspace.id,
          teamspaceId: originalDocument.teamspace?.id,
          parentDocumentId: duplicatedParentDocument?.id,
          title: this.documentTreeService.buildDuplicateTitle(originalDocument.title),
          contentFormat: originalDocument.contentFormat,
          contentJson: originalDocument.contentJson,
          searchText: originalDocument.searchText,
          sortKey: originalDocument.id === sourceDocument.id
            ? await this.documentTreeService.resolveSortKeyForCreate(
              sourceRootDocument.workspace.id,
              sourceRootDocument.parentDocument?.id,
              sourceRootDocument.teamspace?.id,
            )
            : originalDocument.sortKey,
          createdByUserId: currentUser.userId,
          updatedByUserId: currentUser.userId,
        });

        duplicatedDocumentByOriginalId.set(originalDocument.id, duplicatedDocument);
        duplicatedDocumentEntities.push(duplicatedDocument);
      }

      for (const originalDocument of sourceSubtree) {
        const duplicatedDocument = this.getRequiredDuplicatedDocument(
          duplicatedDocumentByOriginalId,
          originalDocument.id,
          'updating duplicated subtree content',
        );
        duplicatedDocument.contentJson = this.documentSubdocContentService.replaceReferencesInContent(
          originalDocument.contentJson,
          duplicatedDocumentByOriginalId,
        );
        duplicatedDocument.contentJson = this.documentSubdocContentService.appendMissingChildBlocks(
          duplicatedDocument.contentJson,
          duplicatedDocument,
          duplicatedDocumentEntities,
        );
        duplicatedDocument.searchText = extractDocumentSearchText(duplicatedDocument.contentJson);
        commandRepository.assignUpdatedByUser(duplicatedDocument, currentUser.userId);
      }

      const duplicatedRootDocumentEntity = this.getRequiredDuplicatedDocument(
        duplicatedDocumentByOriginalId,
        sourceDocument.id,
        'resolving duplicated root document',
      );
      const parentDocument = sourceRootDocument.parentDocument?.id
        ? await commandRepository.findDocument(sourceRootDocument.parentDocument.id)
        : null;

      if (parentDocument) {
        parentDocument.contentJson = this.documentSubdocContentService.appendSubdocBlock(
          parentDocument.contentJson,
          duplicatedRootDocumentEntity,
        );
        parentDocument.searchText = extractDocumentSearchText(parentDocument.contentJson);
        commandRepository.assignUpdatedByUser(parentDocument, currentUser.userId);
      }

      await commandRepository.saveDocuments(
        parentDocument
          ? [...duplicatedDocumentEntities, parentDocument]
          : duplicatedDocumentEntities,
      );

      for (const duplicatedDocument of duplicatedDocumentEntities) {
        await this.syncDocumentSubdocReferencesUseCase.execute(duplicatedDocument, subdocReferenceRepository);
      }
      if (parentDocument) {
        await this.syncDocumentSubdocReferencesUseCase.execute(parentDocument, subdocReferenceRepository);
      }

      await commandRepository.flush();

      return {
        duplicatedRootDocument: duplicatedRootDocumentEntity,
        duplicatedDocuments: duplicatedDocumentEntities,
        originalDocumentByDuplicateId: new Map(
          sourceSubtree.map((originalDocument) => {
            const duplicatedDocument = this.getRequiredDuplicatedDocument(
              duplicatedDocumentByOriginalId,
              originalDocument.id,
              'building duplicate-to-original lookup',
            );

            return [duplicatedDocument.id, originalDocument] as const;
          }),
        ),
      };
    });

    await Promise.all(duplicatedDocuments.map((duplicatedDocument) =>
      this.auditService.record({
        action: 'document.created',
        resourceType: 'document',
        resourceId: duplicatedDocument.id,
        metadata: {
          workspaceId: duplicatedDocument.workspace.id,
          teamspaceId: duplicatedDocument.teamspace?.id,
          parentDocumentId: duplicatedDocument.parentDocument?.id,
          duplicatedFromDocumentId: originalDocumentByDuplicateId.get(duplicatedDocument.id)?.id,
        },
      }),
    ));

    return toDocumentSummary(duplicatedRootDocument);
  }

  private getRequiredDuplicatedDocument(
    duplicatedDocumentByOriginalId: Map<string, DocumentEntity>,
    originalDocumentId: string,
    operation: string,
  ): DocumentEntity {
    const duplicatedDocument = duplicatedDocumentByOriginalId.get(originalDocumentId);

    if (!duplicatedDocument) {
      throw new DocumentDuplicationInvariantError(
        `${operation}: missing duplicate for source document ${originalDocumentId}`,
      );
    }

    return duplicatedDocument;
  }
}
