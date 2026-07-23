import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { DocumentAccessGrantPermission } from '../../domain/enums/document-access-grant-permission.enum';
import {
  DocumentAccessGrantRepository,
  type DocumentAccessGrantSummary,
} from '../ports/document-access-grant.repository';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import {
  DocumentAccessGrantUserNotFoundError,
  DocumentNotFoundError,
} from '../errors/document-app.error';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';

export type ShareDocumentFailureSummary = {
  userId: string;
  reason: 'workspace_user_not_found';
};

export type ShareDocumentsSummary = {
  collaborators: DocumentAccessGrantSummary[];
  failed: ShareDocumentFailureSummary[];
};

@Injectable()
export class ShareDocumentUseCase {
  constructor(
    private readonly documentCommandRepository: DocumentCommandRepository,
    private readonly documentAccessGrantRepository: DocumentAccessGrantRepository,
    private readonly documentAccessCapabilityService: DocumentAccessCapabilityService,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
    input: {
      userId: string;
      permission: DocumentAccessGrantPermission;
    },
  ): Promise<DocumentAccessGrantSummary> {
    const document = await this.documentCommandRepository.findDocument(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    const { workspace } = await this.documentAccessCapabilityService.assertCanManageAccess(document, currentUser);

    const recipient = await this.documentAccessGrantRepository.findWorkspaceUser({
      workspaceId: workspace.id,
      userId: input.userId,
    });

    if (!recipient) {
      throw new DocumentAccessGrantUserNotFoundError(input.userId);
    }

    return this.documentAccessGrantRepository.upsertGrant({
      workspaceId: workspace.id,
      documentId: document.id,
      userId: input.userId,
      permission: input.permission,
      grantedByUserId: currentUser.userId,
    });
  }

  async executeMany(
    documentId: string,
    currentUser: AuthenticatedUser,
    input: {
      grants: Array<{
        userId: string;
        permission: DocumentAccessGrantPermission;
      }>;
    },
  ): Promise<ShareDocumentsSummary> {
    const document = await this.documentCommandRepository.findDocument(documentId);

    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    const { workspace } = await this.documentAccessCapabilityService.assertCanManageAccess(document, currentUser);

    // dedupe by userId, and if the same user appears more than once, the latest grant wins.
    const latestGrantByUserId = new Map(
      input.grants.map((grant) => [grant.userId, grant]),
    );

    const grants = Array.from(latestGrantByUserId.values());

    const recipients = await Promise.all(
      grants.map((grant) =>
        this.documentAccessGrantRepository.findWorkspaceUser({
          workspaceId: workspace.id,
          userId: grant.userId,
        })),
    );

    const validGrants = grants.filter((_, index) => Boolean(recipients[index]));

    const failed = grants
      .filter((_, index) => !recipients[index])
      .map((grant) => ({
        userId: grant.userId,
        reason: 'workspace_user_not_found' as const,
      }));

    const collaborators = await Promise.all(
      validGrants.map((grant) =>
        this.documentAccessGrantRepository.upsertGrant({
          workspaceId: workspace.id,
          documentId: document.id,
          userId: grant.userId,
          permission: grant.permission,
          grantedByUserId: currentUser.userId,
        })),
    );

    return {
      collaborators,
      failed,
    };
  }
}
