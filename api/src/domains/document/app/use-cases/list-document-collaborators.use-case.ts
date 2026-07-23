import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import {
  DocumentAccessGrantRepository,
  type DocumentAccessGrantSummary,
  type InheritedDocumentAccessGrantSummary,
} from '../ports/document-access-grant.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentNotFoundError } from '../errors/document-app.error';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';

export type DocumentCollaboratorSummary =
  | (DocumentAccessGrantSummary & {
    accessSource: 'direct';
  })
  | (InheritedDocumentAccessGrantSummary & {
    accessSource: 'inherited';
  });

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
  ): Promise<DocumentCollaboratorSummary[]> {
    const document = await this.documentCommandRepository.findDocument(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    await this.documentAccessCapabilityService.assertCanView(document, currentUser);

    const [directGrants, inheritedGrants] = await Promise.all([
      this.documentAccessGrantRepository.listActiveGrants(document.id),
      this.documentAccessGrantRepository.listStrongestActiveGrantsInAncestors(document.id),
    ]);

    const directUserIds = new Set(directGrants.map((grant) => grant.user.id));

    const directCollaborators = directGrants.map((grant) => ({
      ...grant,
      accessSource: 'direct' as const,
    }));
    
    const inheritedCollaborators = inheritedGrants
      .filter((grant) => !directUserIds.has(grant.user.id))
      .map((grant) => ({
        ...grant,
        accessSource: 'inherited' as const,
      }));
    
    return [...directCollaborators, ...inheritedCollaborators];
  }
}
