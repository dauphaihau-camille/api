import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { DocumentAccessGrantRepository } from '../ports/document-access-grant.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentNotFoundError } from '../errors/document-app.error';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';

@Injectable()
export class RevokeDocumentAccessUseCase {
  constructor(
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentAccessGrantRepository: DocumentAccessGrantRepository,
    private readonly documentAccessCapabilityService: DocumentAccessCapabilityService,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
    userId: string,
  ): Promise<void> {
    const document = await this.documentCommandRepository.findDocument(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    await this.documentAccessCapabilityService.assertCanManageAccess(document, currentUser);

    await this.documentAccessGrantRepository.revokeGrant({
      documentId: document.id,
      userId,
    });
  }
}
