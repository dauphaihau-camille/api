import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { DocumentAccessGrantPermission } from '../../domain/enums/document-access-grant-permission.enum';
import {
  DocumentAccessGrantRepository,
  type DocumentAccessGrantSummary,
} from '../ports/document-access-grant.repository';
import { DocumentAccessChangedEvent } from '../../events/document-access-changed.event';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import {
  DocumentAccessGrantUserNotFoundError,
  DocumentNotFoundError,
  DocumentShareRecipientRequiredError,
} from '../errors/document-app.error';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';
import {
  DocumentInvitationRepository,
  type DocumentInvitationSummary,
} from '../ports/document-invitation.repository';

export type ShareDocumentFailureSummary = {
  email?: string;
  userId?: string;
  reason: 'user_not_found';
};

export type ShareDocumentsSummary = {
  collaborators: DocumentAccessGrantSummary[];
  invitations: DocumentInvitationSummary[];
  failed: ShareDocumentFailureSummary[];
};

@Injectable()
export class ShareDocumentUseCase {
  constructor(
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentAccessGrantRepository: DocumentAccessGrantRepository,
    private readonly documentInvitationRepository: DocumentInvitationRepository,
    private readonly documentAccessCapabilityService: DocumentAccessCapabilityService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
    input: {
      email?: string;
      userId?: string;
      permission: DocumentAccessGrantPermission;
    },
  ): Promise<DocumentAccessGrantSummary> {
    const document = await this.documentCommandRepository.findDocument(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    const { workspace } = await this.documentAccessCapabilityService.assertCanManageAccess(document, currentUser);

    const recipient = input.userId
      ? await this.documentAccessGrantRepository.findUserById(input.userId)
      : input.email
        ? await this.documentAccessGrantRepository.findUserByEmail(this.normalizeEmail(input.email))
        : null;

    if (!recipient) {
      throw input.userId
        ? new DocumentAccessGrantUserNotFoundError(input.userId)
        : new DocumentShareRecipientRequiredError();
    }

    const grant = await this.documentAccessGrantRepository.upsertGrant({
      workspaceId: workspace.id,
      documentId: document.id,
      userId: recipient.id,
      permission: input.permission,
      grantedByUserId: currentUser.userId,
    });

    this.emitAccessChanged(document.id, workspace.id);

    return grant;
  }

  async executeMany(
    documentId: string,
    currentUser: AuthenticatedUser,
    input: {
      grants: Array<{
        email?: string;
        userId?: string;
        permission: DocumentAccessGrantPermission;
      }>;
    },
  ): Promise<ShareDocumentsSummary> {
    const document = await this.documentCommandRepository.findDocument(documentId);

    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    const { workspace } = await this.documentAccessCapabilityService.assertCanManageAccess(document, currentUser);

    // Dedupe by recipient, and if the same recipient appears more than once, the latest grant wins.
    const latestGrantByRecipient = new Map(
      input.grants.map((grant) => [this.getRecipientKey(grant), grant]),
    );

    const grants = Array.from(latestGrantByRecipient.values());

    const recipients = await Promise.all(
      grants.map((grant) => this.findRecipient(grant)),
    );

    const grantRecipientPairs = grants.map((grant, index) => ({
      grant,
      recipient: recipients[index],
    }));

    const validGrants = grantRecipientPairs
      .filter(({ recipient }) => Boolean(recipient))
      .map(({ grant, recipient }) => ({
        grant,
        recipient: recipient!,
      }));

    const invitationGrants = grantRecipientPairs.filter(({ grant, recipient }) =>
      !recipient && Boolean(grant.email));

    const failed = grantRecipientPairs
      .filter(({ grant, recipient }) => !recipient && !grant.email)
      .map(({ grant }) => ({
        userId: grant.userId,
        reason: 'user_not_found' as const,
      }));

    const collaborators = await Promise.all(
      validGrants.map(({ grant, recipient }) =>
        this.documentAccessGrantRepository.upsertGrant({
          workspaceId: workspace.id,
          documentId: document.id,
          userId: recipient.id,
          permission: grant.permission,
          grantedByUserId: currentUser.userId,
        })),
    );

    const invitations = await Promise.all(
      invitationGrants.map(({ grant }) =>
        this.documentInvitationRepository.upsertInvitation({
          workspaceId: workspace.id,
          documentId: document.id,
          email: this.normalizeEmail(grant.email!),
          permission: grant.permission,
          invitedByUserId: currentUser.userId,
        })),
    );

    if (collaborators.length > 0 || invitations.length > 0) {
      this.emitAccessChanged(document.id, workspace.id);
    }

    return {
      collaborators,
      invitations,
      failed,
    };
  }

  private async findRecipient(input: {
    email?: string;
    userId?: string;
  }) {
    if (input.userId) {
      return this.documentAccessGrantRepository.findUserById(input.userId);
    }

    if (input.email) {
      return this.documentAccessGrantRepository.findUserByEmail(this.normalizeEmail(input.email));
    }

    return null;
  }

  private getRecipientKey(input: {
    email?: string;
    userId?: string;
  }): string {
    if (input.userId) {
      return `user:${input.userId}`;
    }

    if (input.email) {
      return `email:${this.normalizeEmail(input.email)}`;
    }

    throw new DocumentShareRecipientRequiredError();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private emitAccessChanged(documentId: string, workspaceId: string): void {
    this.eventEmitter.emit(
      'document.access.changed',
      new DocumentAccessChangedEvent(documentId, workspaceId),
    );
  }
}
