import { Injectable } from '@nestjs/common';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceRepository } from '../ports/document-subdoc-reference.repository';
import { DocumentSubdocContentService } from '../services/document-subdoc-content.service';
import { extractDocumentSearchText } from '../utils/document-search-text.util';
import { SyncDocumentSubdocReferencesUseCase } from './sync-document-subdoc-references.use-case';

@Injectable()
export class SyncReferencedSubdocTitlesUseCase {
  constructor(
    private readonly documentSubdocReferenceRepository: DocumentSubdocReferenceRepository,
    private readonly documentSubdocContentService: DocumentSubdocContentService,
    private readonly syncDocumentSubdocReferencesUseCase: SyncDocumentSubdocReferencesUseCase,
  ) {}

  async execute(document: DocumentEntity): Promise<void> {
    const references = await this.documentSubdocReferenceRepository
      .findReferencesByTargetDocument(document.id);

    if (references.length === 0) {
      const referencingDocuments = await this.documentSubdocReferenceRepository
        .findReferencingDocuments(document.workspace.id, document.id);

      for (const sourceDocument of referencingDocuments) {
        await this.syncTitleIntoSourceDocument(sourceDocument, document, true);
      }

      return;
    }

    for (const reference of references) {
      await this.syncTitleIntoSourceDocument(reference.sourceDocument, document, false);
    }
  }

  private async syncTitleIntoSourceDocument(
    sourceDocument: DocumentEntity,
    targetDocument: DocumentEntity,
    shouldResyncReferences: boolean,
  ): Promise<void> {
    const { changed, content } = this.documentSubdocContentService.replaceTitle(
      sourceDocument.contentJson,
      targetDocument.id,
      targetDocument.title,
    );

    if (!changed) {
      return;
    }

    sourceDocument.contentJson = content;
    sourceDocument.searchText = extractDocumentSearchText(content);
    sourceDocument.updatedBy = targetDocument.updatedBy;

    if (shouldResyncReferences) {
      await this.syncDocumentSubdocReferencesUseCase.execute(sourceDocument);
    }
  }
}
