import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { startAiProviderSpan as startAiProviderSpanType } from './ai-provider-telemetry';
import { AiProviderHttpError } from './ai-provider-error';

const span = {
  end: jest.fn(),
  setAttributes: jest.fn(),
  setStatus: jest.fn(),
};

jest.spyOn(trace, 'getTracer').mockReturnValue({
  startSpan: jest.fn().mockReturnValue(span),
} as never);

const { startAiProviderSpan } = jest.requireActual('./ai-provider-telemetry') as {
  startAiProviderSpan: typeof startAiProviderSpanType;
};

describe('AI provider telemetry', () => {
  beforeEach(() => {
    span.end.mockClear();
    span.setAttributes.mockClear();
    span.setStatus.mockClear();
  });

  it('records safe provider attributes for successful requests', () => {
    const providerSpan = startAiProviderSpan({
      provider: 'groq',
      operation: 'generate_text',
      model: 'openai/gpt-oss-20b',
    });

    providerSpan.endSuccess({ model: 'openai/gpt-oss-20b', finishReason: 'stop' });

    expect(span.setAttributes).toHaveBeenCalledWith(expect.objectContaining({
      'ai.duration_ms': expect.any(Number),
      'ai.response.finish_reason': 'stop',
      'ai.response.model': 'openai/gpt-oss-20b',
      'ai.status': 'ok',
    }));
    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it('records safe provider attributes for failed requests', () => {
    const providerSpan = startAiProviderSpan({
      provider: 'openrouter',
      operation: 'stream_text',
      model: 'openai/gpt-oss-20b',
    });

    providerSpan.endError(new AiProviderHttpError('provider failed', 429, 'openrouter'));

    expect(span.setAttributes).toHaveBeenCalledWith(expect.objectContaining({
      'ai.duration_ms': expect.any(Number),
      'ai.http.status_code': 429,
      'ai.status': 'error',
      'error.type': 'Error',
    }));
    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
    expect(span.end).toHaveBeenCalledTimes(1);
  });
});
