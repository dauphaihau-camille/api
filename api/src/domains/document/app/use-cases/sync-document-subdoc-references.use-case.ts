import { Injectable } from '@nestjs/common';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceRepository } from '../ports/document-subdoc-reference.repository';
import { DocumentSubdocReferenceSyncService } from '../services/document-subdoc-reference-sync.service';

@Injectable()
export class SyncDocumentSubdocReferencesUseCase {
  constructor(
    private readonly documentSubdocReferenceRepository: DocumentSubdocReferenceRepository,
    private readonly documentSubdocReferenceSyncService: DocumentSubdocReferenceSyncService,
  ) {}

  async execute(
    document: DocumentEntity,
    repository: DocumentSubdocReferenceRepository = this.documentSubdocReferenceRepository,
  ): Promise<void> {
    await this.documentSubdocReferenceSyncService.execute(document, repository);
  }
}
