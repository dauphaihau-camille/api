import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ObservabilityService } from '../../../platform/observability/observability.service';
import { getActiveTraceContext } from '../../../platform/observability/tracing';
import { RequestContextService } from '../../../platform/request-context/request-context.service';

@Injectable()
export class DocumentObservabilityService {
  private readonly documentReadDurationSeconds: Histogram<'stage'>;
  private readonly documentVisitRecordingTotal: Counter<'status'>;
  private readonly documentVisitRecordingDurationSeconds: Histogram<'status'>;

  constructor(
    private readonly observabilityService: ObservabilityService,
    private readonly requestContextService: RequestContextService,
    @InjectPinoLogger(DocumentObservabilityService.name)
    private readonly logger: PinoLogger,
  ) {
    const registry = this.observabilityService.getRegistry();

    this.documentReadDurationSeconds = new Histogram({
      name: 'app_document_read_duration_seconds',
      help: 'Document read durations grouped by read stage.',
      labelNames: ['stage'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [registry],
    });
    this.documentVisitRecordingTotal = new Counter({
      name: 'app_document_visit_recording_total',
      help: 'Total number of document visit recording attempts.',
      labelNames: ['status'],
      registers: [registry],
    });
    this.documentVisitRecordingDurationSeconds = new Histogram({
      name: 'app_document_visit_recording_duration_seconds',
      help: 'Document visit recording duration grouped by final status.',
      labelNames: ['status'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [registry],
    });
  }

  recordDocumentReadDuration(
    stage: 'workspace_access' | 'related_queries' | 'total',
    durationMs: number,
  ): void {
    this.documentReadDurationSeconds.observe({ stage }, durationMs / 1_000);
  }

  recordDocumentVisitRecording(
    status: 'ok' | 'error',
    durationMs: number,
  ): void {
    this.documentVisitRecordingTotal.inc({ status });
    this.documentVisitRecordingDurationSeconds.observe(
      { status },
      durationMs / 1_000,
    );
  }

  logDocumentVisitRecordingFailure(input: {
    documentId: string;
    workspaceId: string;
    userId: string;
    error: unknown;
  }): void {
    const requestContext = this.requestContextService.get();
    const traceContext = getActiveTraceContext();

    this.logger.warn(
      {
        actorId: requestContext.actorId,
        actorEmail: requestContext.actorEmail,
        context: DocumentObservabilityService.name,
        document: {
          documentId: input.documentId,
          workspaceId: input.workspaceId,
        },
        error: input.error,
        event: 'document.visit_recording.failed',
        requestId: requestContext.requestId,
        sessionId: requestContext.sessionId,
        spanId: traceContext?.spanId,
        traceId: traceContext?.traceId,
        userId: input.userId,
      },
      'Failed to record document visit after returning document detail',
    );
  }
}
