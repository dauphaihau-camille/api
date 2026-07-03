import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { AuditService } from '~/modules/shared/audit/audit.service';
import { canEditWorkspace } from '../../../workspace/app/workspace-permissions';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentSummary } from '../contracts/document.contract';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { toDocumentSummary } from '../mappers/document-summary.mapper';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import {
  ArchivedDocumentDuplicationError,
  DocumentNotFoundError,
  DocumentPermissionDeniedError,
} from '../errors/document-app.error';
import { DocumentSubdocService } from '../services/document-subdoc.service';
import { DocumentTreeService } from '../services/document-tree.service';
import { extractDocumentSearchText } from '../utils/document-search-text.util';

@Injectable()
export class DuplicateDocumentUseCase {
  constructor(
    private readonly auditService: AuditService,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentSubdocService: DocumentSubdocService,
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
    if (!canEditWorkspace(workspace.currentUserRole)) {
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
    const sourceRootDocument = sourceSubtree[0]!;

    const {
      duplicatedRootDocument,
      duplicatedDocuments,
      originalDocumentByDuplicateId,
    } = await this.documentCommandRepository.withTransaction(async ({
      commandRepository,
      subdocReferenceRepository,
    }) => {
      const actor = await commandRepository.findCurrentUser(currentUser.userId) as CurrentUserEntity;
      const duplicatedDocumentByOriginalId = new Map<string, DocumentEntity>();
      const duplicatedDocumentEntities: DocumentEntity[] = [];

      for (const originalDocument of sourceSubtree) {
        const duplicatedParentDocument = originalDocument.id === sourceDocument.id
          ? sourceRootDocument.parentDocument
          : duplicatedDocumentByOriginalId.get(originalDocument.parentDocument?.id ?? '');

        const duplicatedDocument = commandRepository.createDocument({
          workspace: originalDocument.workspace,
          teamspace: originalDocument.teamspace,
          parentDocument: duplicatedParentDocument,
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
          createdBy: actor,
          updatedBy: actor,
        });

        duplicatedDocumentByOriginalId.set(originalDocument.id, duplicatedDocument);
        duplicatedDocumentEntities.push(duplicatedDocument);
      }

      for (const originalDocument of sourceSubtree) {
        const duplicatedDocument = duplicatedDocumentByOriginalId.get(originalDocument.id)!;
        duplicatedDocument.contentJson = this.documentSubdocService.replaceSubdocReferencesInContent(
          originalDocument.contentJson,
          duplicatedDocumentByOriginalId,
        );
        duplicatedDocument.contentJson = this.documentSubdocService.appendMissingChildSubdocBlocks(
          duplicatedDocument.contentJson,
          duplicatedDocument,
          duplicatedDocumentEntities,
        );
        duplicatedDocument.searchText = extractDocumentSearchText(duplicatedDocument.contentJson);
        duplicatedDocument.updatedBy = actor;
      }

      await commandRepository.saveDocuments(duplicatedDocumentEntities);

      for (const duplicatedDocument of duplicatedDocumentEntities) {
        await this.documentSubdocService.syncSubdocReferencesForDoc(duplicatedDocument, subdocReferenceRepository);
      }

      await commandRepository.flush();

      return {
        duplicatedRootDocument: duplicatedDocumentByOriginalId.get(sourceDocument.id)!,
        duplicatedDocuments: duplicatedDocumentEntities,
        originalDocumentByDuplicateId: new Map(
          sourceSubtree.map((originalDocument) => [
            duplicatedDocumentByOriginalId.get(originalDocument.id)!.id,
            originalDocument,
          ]),
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
}
