import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { DocumentObservabilityService } from '../../observability/document-observability.service';
import type { DocumentSummary } from '../contracts/document.contract';
import { DocumentNotFoundError } from '../errors/document-app.error';
import { DocumentDetailQueryRepository } from '../ports/document-detail-query.repository';
import { DocumentVisitRepository } from '../ports/document-visit.repository';

@Injectable()
export class GetDocumentUseCase {
  constructor(
    private readonly documentDetailQueryRepository: DocumentDetailQueryRepository,
    private readonly documentVisitRepository: DocumentVisitRepository,
    private readonly documentObservabilityService: DocumentObservabilityService,
  ) {}

  async execute(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentSummary> {
    const startedAt = Date.now();

    const document = await this.documentDetailQueryRepository.findDocumentDetail({
      documentId,
      currentUser,
    });

    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    const visitRecordingStartedAt = Date.now();

    void this.documentVisitRepository.recordVisit({
      documentId: document.id,
      workspaceId: document.workspaceId,
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
          workspaceId: document.workspaceId,
          userId: currentUser.userId,
          error,
        });
      });

    const totalDurationMs = Date.now() - startedAt;
    this.documentObservabilityService.recordDocumentReadDuration('total', totalDurationMs);

    return document;
  }
}
