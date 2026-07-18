import { Injectable } from '@nestjs/common';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceRepository } from '../ports/document-subdoc-reference.repository';
import { DocumentSubdocContentService } from '../services/document-subdoc-content.service';
import { extractDocumentSearchText } from '../utils/document-search-text.util';
import { SyncDocumentSubdocReferencesUseCase } from './sync-document-subdoc-references.use-case';

@Injectable()
export class RemoveArchivedSubdocReferencesUseCase {
  constructor(
    private readonly documentSubdocContentService: DocumentSubdocContentService,
    private readonly syncDocumentSubdocReferencesUseCase: SyncDocumentSubdocReferencesUseCase,
    private readonly documentSubdocReferenceRepository: DocumentSubdocReferenceRepository,
  ) {}

  async execute(
    targetDocuments: DocumentEntity[],
    repository: DocumentSubdocReferenceRepository = this.documentSubdocReferenceRepository,
  ): Promise<void> {
    if (targetDocuments.length === 0) {
      return;
    }

    const archivedDocumentIds = new Set(targetDocuments.map((document) => document.id));
    const externalSourceDocumentsById = new Map<string, DocumentEntity>();

    for (const targetDocument of targetDocuments) {
      const references = await repository.findReferencesByTargetDocument(targetDocument.id);

      if (references.length === 0) {
        const referencingDocuments = await repository.findReferencingDocuments(
          targetDocument.workspace.id,
          targetDocument.id,
        );

        for (const sourceDocument of referencingDocuments) {
          if (archivedDocumentIds.has(sourceDocument.id)) {
            continue;
          }

          externalSourceDocumentsById.set(sourceDocument.id, sourceDocument);
        }

        continue;
      }

      for (const reference of references) {
        const sourceDocument = reference.sourceDocument;

        if (archivedDocumentIds.has(sourceDocument.id)) {
          continue;
        }

        externalSourceDocumentsById.set(sourceDocument.id, sourceDocument);
      }
    }

    for (const sourceDocument of externalSourceDocumentsById.values()) {
      const { changed, content } = this.documentSubdocContentService.removeBlocks(
        sourceDocument.contentJson,
        archivedDocumentIds,
      );

      if (!changed) {
        continue;
      }

      sourceDocument.contentJson = content;
      sourceDocument.searchText = extractDocumentSearchText(content);
      sourceDocument.updatedBy = targetDocuments[0]?.updatedBy ?? sourceDocument.updatedBy;
      await this.syncDocumentSubdocReferencesUseCase.execute(sourceDocument, repository);
    }
  }
}
