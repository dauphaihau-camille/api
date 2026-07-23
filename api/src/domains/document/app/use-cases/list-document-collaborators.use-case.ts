import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import {
  DocumentAccessGrantRepository,
  type DocumentAccessGrantSummary,
} from '../ports/document-access-grant.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentNotFoundError } from '../errors/document-app.error';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';

@Injectable()
export class ListDocumentCollaboratorsUseCase {
  constructor(
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentAccessGrantRepository: DocumentAccessGrantRepository,
    private readonly documentAccessCapabilityService: DocumentAccessCapabilityService,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentAccessGrantSummary[]> {
    const document = await this.documentCommandRepository.findDocument(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    await this.documentAccessCapabilityService.assertCanView(document, currentUser);

    return this.documentAccessGrantRepository.listActiveGrants(document.id);
  }
}
