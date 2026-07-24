import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { DocumentAccessChangedEvent } from '../../events/document-access-changed.event';
import { DocumentInvitationRepository } from '../ports/document-invitation.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import {
  DocumentInvitationNotFoundError,
  DocumentNotFoundError,
} from '../errors/document-app.error';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';

@Injectable()
export class RevokeDocumentInvitationUseCase {
  constructor(
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentInvitationRepository: DocumentInvitationRepository,
    private readonly documentAccessCapabilityService: DocumentAccessCapabilityService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    documentId: string,
    invitationId: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    const document = await this.documentCommandRepository.findDocument(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    const { workspace } = await this.documentAccessCapabilityService.assertCanManageAccess(document, currentUser);

    const invitation = await this.documentInvitationRepository.revokeInvitation({
      documentId: document.id,
      invitationId,
    });

    if (!invitation) {
      throw new DocumentInvitationNotFoundError(invitationId);
    }

    this.eventEmitter.emit(
      'document.access.changed',
      new DocumentAccessChangedEvent(document.id, workspace.id),
    );
  }
}
