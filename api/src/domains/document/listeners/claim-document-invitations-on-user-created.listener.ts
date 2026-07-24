import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { UserCreatedEvent } from '~/domains/user/events/user-created.event';
import { DocumentAccessChangedEvent } from '../events/document-access-changed.event';
import { DocumentAccessGrantRepository } from '../app/ports/document-access-grant.repository';
import { DocumentInvitationRepository } from '../app/ports/document-invitation.repository';

@Injectable()
export class ClaimDocumentInvitationsOnUserCreatedListener {
  constructor(
    private readonly documentInvitationRepository: DocumentInvitationRepository,
    private readonly documentAccessGrantRepository: DocumentAccessGrantRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('user.created', { async: true, suppressErrors: true })
  async handle(event: UserCreatedEvent): Promise<void> {
    const invitations = await this.documentInvitationRepository.listActiveInvitationsForEmail(
      event.email.trim().toLowerCase(),
    );

    for (const invitation of invitations) {
      await this.documentAccessGrantRepository.upsertGrant({
        workspaceId: invitation.workspaceId,
        documentId: invitation.documentId,
        userId: event.userId,
        permission: invitation.permission,
        grantedByUserId: invitation.invitedByUserId,
      });
      await this.documentInvitationRepository.markInvitationAccepted({
        invitationId: invitation.id,
        userId: event.userId,
      });
      this.eventEmitter.emit(
        'document.access.changed',
        new DocumentAccessChangedEvent(invitation.documentId, invitation.workspaceId),
      );
    }
  }
}
