import { Injectable } from '@nestjs/common';
import type { PublicDocumentSummary } from '../publish.types';
import {
  ArchivedDocumentPublicAccessDeniedError,
  PublishedDocumentNotFoundError,
} from '../errors/publish-app.error';
import { PublishRepository } from '../ports/publish.repository';

@Injectable()
export class GetPublicDocumentUseCase {
  constructor(private readonly publishRepository: PublishRepository) {}

  async execute(
    publishedDocumentId: string,
  ): Promise<PublicDocumentSummary> {
    const publishedDocument = await this.publishRepository.findPublishedDocumentById(
      publishedDocumentId,
    );

    if (!publishedDocument) {
      throw new PublishedDocumentNotFoundError(publishedDocumentId);
    }

    if (publishedDocument.archivedAt) {
      throw new ArchivedDocumentPublicAccessDeniedError();
    }

    return this.publishRepository.buildPublicDocumentSummary(publishedDocument.id);
  }
}
