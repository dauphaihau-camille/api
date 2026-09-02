import { SpanStatusCode, trace } from '@opentelemetry/api';
import { performance } from 'node:perf_hooks';
import type { GenerateTextResult } from '../app/ai.types';
import { extractErrorStatus } from './ai-provider-error';

export type AiProviderOperation = 'generate_text' | 'stream_text' | 'embed_text';

type AiProviderSpanInput = {
  provider: string;
  operation: AiProviderOperation;
  model: string;
};

const tracer = trace.getTracer('camille-api.ai-provider');

export function startAiProviderSpan(input: AiProviderSpanInput) {
  const startedAt = performance.now();

  const span = tracer.startSpan(`ai.${input.provider}.${input.operation}`, {
    attributes: {
      'ai.operation': input.operation,
      'ai.provider': input.provider,
      'ai.request.model': input.model,
      'ai.system': input.provider,
    },
  });

  return {
    endSuccess(result?: Pick<GenerateTextResult, 'finishReason' | 'model'>) {
      span.setAttributes({
        'ai.duration_ms': resolveDurationMs(startedAt),
        'ai.status': 'ok',
        ...(result?.model ? { 'ai.response.model': result.model } : {}),
        ...(result?.finishReason ? { 'ai.response.finish_reason': result.finishReason } : {}),
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    },
    endError(error: unknown) {
      const httpStatusCode = extractErrorStatus(error);

      span.setAttributes({
        'ai.duration_ms': resolveDurationMs(startedAt),
        'ai.status': 'error',
        ...(httpStatusCode !== undefined ? { 'ai.http.status_code': httpStatusCode } : {}),
        ...(error instanceof Error ? { 'error.type': error.name } : {}),
      });
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
    },
  };
}

function resolveDurationMs(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 1000) / 1000;
}
