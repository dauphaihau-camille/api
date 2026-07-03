import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { AuditService } from '~/modules/shared/audit/audit.service';
import { canEditWorkspace } from '../../../workspace/app/workspace-permissions';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { PublishedDocumentSummary } from '../publish.types';
import {
  PublishDocumentNotFoundError,
  PublishPermissionDeniedError,
} from '../errors/publish-app.error';
import { toPublishedDocumentSummary } from '../mappers/publish-summary.mapper';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { PublishRepository } from '../ports/publish.repository';

@Injectable()
export class PublishDocumentUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly publishRepository: PublishRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<PublishedDocumentSummary> {
    const document = await this.publishRepository.findDocument(documentId);

    if (!document) {
      throw new PublishDocumentNotFoundError(documentId);
    }

    const workspace = await resolveWorkspaceForUser(
      this.workspaceRepository,
      document.workspace.id,
      currentUser,
    );

    if (!canEditWorkspace(workspace.currentUserRole)) {
      throw new PublishPermissionDeniedError();
    }

    const { publishedDocument, created } = await this.publishRepository.publishDocument(
      document,
      currentUser.userId,
    );

    if (created) {
      await this.auditService.record({
        action: 'document.published',
        resourceType: 'document',
        resourceId: document.id,
        metadata: {
          workspaceId: document.workspace.id,
          publishedDocumentId: publishedDocument.id,
        },
      });
    }

    return toPublishedDocumentSummary(document.id, publishedDocument);
  }
}
