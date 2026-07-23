import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { DocumentAccessChangedEvent } from '../../events/document-access-changed.event';
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
    private readonly eventEmitter: EventEmitter2,
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

    const { workspace } = await this.documentAccessCapabilityService.assertCanManageAccess(document, currentUser);

    const revokedGrant = await this.documentAccessGrantRepository.revokeGrant({
      documentId: document.id,
      userId,
    });

    if (revokedGrant) {
      this.eventEmitter.emit(
        'document.access.changed',
        new DocumentAccessChangedEvent(document.id, workspace.id),
      );
    }
  }
}
