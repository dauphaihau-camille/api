import { Injectable } from '@nestjs/common';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from '../../infra/persistence/entities/document-subdoc-reference.entity';
import { DocumentSubdocReferenceRepository } from '../ports/document-subdoc-reference.repository';
import { DocumentSubdocContentService } from './document-subdoc-content.service';

@Injectable()
export class DocumentSubdocReferenceSyncService {
  constructor(
    private readonly documentSubdocContentService: DocumentSubdocContentService,
  ) {}

  async execute(
    document: DocumentEntity,
    repository: DocumentSubdocReferenceRepository,
  ): Promise<void> {
    const nextTargetDocumentIds =
      this.documentSubdocContentService.extractTargetDocumentIds(document.contentJson);
    const existingReferences = await repository.findReferencesBySourceDocument(document.id);

    const existingTargetDocumentIds = new Set(
      existingReferences.map((reference) => reference.targetDocument.id),
    );

    for (const reference of existingReferences) {
      if (nextTargetDocumentIds.has(reference.targetDocument.id)) {
        continue;
      }

      repository.removeSubdocReference(reference);
    }

    const newReferences: DocumentSubdocReferenceEntity[] = [];

    for (const targetDocumentId of nextTargetDocumentIds) {
      if (existingTargetDocumentIds.has(targetDocumentId)) {
        continue;
      }

      newReferences.push(repository.createSubdocReference({
        workspace: document.workspace.id,
        sourceDocument: document.id,
        targetDocument: targetDocumentId,
      }));
    }

    if (newReferences.length > 0) {
      repository.persistSubdocReferences(newReferences);
    }
  }
}
