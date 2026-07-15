import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { PublishRepository } from '../../../publish/app/ports/publish.repository';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { DocumentObservabilityService } from '../../observability/document-observability.service';
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
    private readonly publishRepository: PublishRepository,
    private readonly documentObservabilityService: DocumentObservabilityService,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentSummary> {
    const startedAt = Date.now();
    const document = await this.documentNavigationQueryRepository.findDocument(documentId);

    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    const accessStartedAt = Date.now();
    await resolveWorkspaceForUser(this.workspaceRepository, document.workspace.id, currentUser);
    const accessDurationMs = Date.now() - accessStartedAt;
    this.documentObservabilityService.recordDocumentReadDuration('workspace_access', accessDurationMs);

    const relatedDataStartedAt = Date.now();
    const [favoriteDocumentIds, publishedDocument, breadcrumb] = await Promise.all([
      this.documentNavigationQueryRepository.findFavoriteDocumentIds({
        workspaceId: document.workspace.id,
        userId: currentUser.userId,
        documentIds: [document.id],
      }),
      this.publishRepository.findPublishedDocumentByDocumentId(document.id),
      this.documentNavigationQueryRepository.findAncestors(document.parentDocument?.id),
    ]);
    const relatedDataDurationMs = Date.now() - relatedDataStartedAt;
    this.documentObservabilityService.recordDocumentReadDuration('related_queries', relatedDataDurationMs);

    const visitRecordingStartedAt = Date.now();
    void this.documentVisitRepository.recordVisit({
      documentId: document.id,
      workspaceId: document.workspace.id,
      userId: currentUser.userId,
    })
      .then(() => {
        this.documentObservabilityService.recordDocumentVisitRecording(
          'ok',
          Date.now() - visitRecordingStartedAt,
        );
      })
      .catch((error: unknown) => {
        const durationMs = Date.now() - visitRecordingStartedAt;

        this.documentObservabilityService.recordDocumentVisitRecording('error', durationMs);
        this.documentObservabilityService.logDocumentVisitRecordingFailure({
          documentId: document.id,
          workspaceId: document.workspace.id,
          userId: currentUser.userId,
          error,
        });
      });

    const totalDurationMs = Date.now() - startedAt;
    this.documentObservabilityService.recordDocumentReadDuration('total', totalDurationMs);

    return {
      ...toDocumentSummary(document),
      isFavorite: favoriteDocumentIds.includes(document.id),
      publishedDocumentId: publishedDocument?.id,
      publicPath: publishedDocument ? `/share/${publishedDocument.id}` : undefined,
      breadcrumb,
    };
  }
}
