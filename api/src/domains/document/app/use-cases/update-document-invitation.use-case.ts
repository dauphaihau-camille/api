import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { DocumentAccessChangedEvent } from '../../events/document-access-changed.event';
import type { DocumentAccessGrantPermission } from '../../domain/enums/document-access-grant-permission.enum';
import type { DocumentInvitationSummary } from '../ports/document-invitation.repository';
import { DocumentInvitationRepository } from '../ports/document-invitation.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import {
  DocumentInvitationNotFoundError,
  DocumentNotFoundError,
} from '../errors/document-app.error';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class UpdateDocumentInvitationUseCase {
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
    input: {
      permission: DocumentAccessGrantPermission;
    },
  ): Promise<DocumentInvitationSummary> {
    const document = await this.documentCommandRepository.findDocument(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    const { workspace } = await this.documentAccessCapabilityService.assertCanManageAccess(document, currentUser);

    const invitation = await this.documentInvitationRepository.updateInvitationPermission({
      documentId: document.id,
      invitationId,
      permission: input.permission,
    });

    if (!invitation) {
      throw new DocumentInvitationNotFoundError(invitationId);
    }

    this.eventEmitter.emit(
      'document.access.changed',
      new DocumentAccessChangedEvent(document.id, workspace.id),
    );

    return invitation;
  }
}
