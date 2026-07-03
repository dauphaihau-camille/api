import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import type { DocumentSummary } from '../contracts/document.contract';
import { DocumentNotFoundError } from '../errors/document-app.error';
import { toDocumentSummary } from '../mappers/document-summary.mapper';
import { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import { DocumentVisitRepository } from '../ports/document-visit.repository';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';

@Injectable()
export class GetDocumentUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentNavigationQueryRepository: DocumentNavigationQueryRepository,
    private readonly documentVisitRepository: DocumentVisitRepository,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentSummary> {
    const document = await this.documentNavigationQueryRepository.findDocument(documentId);

    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    await resolveWorkspaceForUser(this.workspaceRepository, document.workspace.id, currentUser);
    await this.documentVisitRepository.recordVisit(document, currentUser.userId);

    return toDocumentSummary(document);
  }
}
