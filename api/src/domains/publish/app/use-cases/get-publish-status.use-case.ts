import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { DocumentAccessResolver } from '~/domains/document/app/policies/document-access.resolver';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { PublishedDocumentSummary } from '../publish.types';
import { PublishDocumentNotFoundError } from '../errors/publish-app.error';
import { toPublishedDocumentSummary } from '../mappers/publish-summary.mapper';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { PublishRepository } from '../ports/publish.repository';

@Injectable()
export class GetPublishStatusUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly publishRepository: PublishRepository,
    private readonly documentAccessResolver: DocumentAccessResolver,
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
      document.workspaceId,
      currentUser,
    );

    if (!this.documentAccessResolver.resolve({
      actorUserId: currentUser.userId,
      documentOwnerUserId: document.ownerUserId,
      documentTeamspaceId: document.teamspaceId,
      workspaceRole: workspace.currentUserRole,
    }).canView) {
      throw new PublishDocumentNotFoundError(documentId);
    }

    const publishedDocument = await this.publishRepository.findPublishedDocumentByDocumentId(
      document.id,
    );

    return toPublishedDocumentSummary(document.id, publishedDocument);
  }
}
