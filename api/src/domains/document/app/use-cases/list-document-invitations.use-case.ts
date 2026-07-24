import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import type { DocumentInvitationSummary } from '../ports/document-invitation.repository';
import { DocumentInvitationRepository } from '../ports/document-invitation.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentNotFoundError } from '../errors/document-app.error';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';

@Injectable()
export class ListDocumentInvitationsUseCase {
  constructor(
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentInvitationRepository: DocumentInvitationRepository,
    private readonly documentAccessCapabilityService: DocumentAccessCapabilityService,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentInvitationSummary[]> {
    const document = await this.documentCommandRepository.findDocument(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    await this.documentAccessCapabilityService.assertCanView(document, currentUser);

    return this.documentInvitationRepository.listActiveInvitations(document.id);
  }
}
