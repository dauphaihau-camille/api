import type { AiProvider } from '../app/ports/ai-provider';
import type { StreamTextEvent } from '../app/ai.types';
import { AiProviderHttpError } from './ai-provider-error';
import { AiRouterProvider } from './ai-router-provider';

describe('AiRouterProvider', () => {
  function createProvider(overrides: Partial<jest.Mocked<AiProvider>> = {}): jest.Mocked<AiProvider> {
    return {
      generateText: jest.fn().mockResolvedValue({
        text: 'generated',
        model: 'model-1',
        finishReason: 'stop',
      }),
      streamText: jest.fn().mockReturnValue((async function* streamText() {
        yield { type: 'delta', text: 'generated' };
        yield {
          type: 'done',
          result: {
            text: 'generated',
            model: 'model-1',
            finishReason: 'stop',
          },
        };
      })()),
      embedText: jest.fn().mockResolvedValue({
        embeddings: [[0.1, 0.2]],
        model: 'embedding-model',
      }),
      ...overrides,
    };
  }

  it('falls back to the next text provider after a rate limit', async () => {
    const primary = createProvider({
      generateText: jest.fn().mockRejectedValue(
        new AiProviderHttpError('rate limited', 429, 'gemini'),
      ),
    });
    const fallback = createProvider({
      generateText: jest.fn().mockResolvedValue({
        text: 'fallback response',
        model: 'groq-model',
        finishReason: 'stop',
      }),
    });
    const router = new AiRouterProvider([
      { name: 'gemini', provider: primary },
      { name: 'groq', provider: fallback },
    ], { name: 'openai', provider: createProvider() });

    await expect(router.generateText({ prompt: 'hello' })).resolves.toEqual({
      text: 'fallback response',
      model: 'groq-model',
      finishReason: 'stop',
    });
    expect(primary.generateText).toHaveBeenCalledTimes(1);
    expect(fallback.generateText).toHaveBeenCalledTimes(1);
  });

  it('does not fallback for non-transient provider errors', async () => {
    const primary = createProvider({
      generateText: jest.fn().mockRejectedValue(new Error('invalid api key')),
    });
    const fallback = createProvider();
    const router = new AiRouterProvider([
      { name: 'gemini', provider: primary },
      { name: 'groq', provider: fallback },
    ], { name: 'openai', provider: createProvider() });

    await expect(router.generateText({ prompt: 'hello' })).rejects.toThrow('invalid api key');
    expect(fallback.generateText).not.toHaveBeenCalled();
  });

  it('falls back to the next stream provider before yielding output', async () => {
    const primary = createProvider({
      streamText: jest.fn().mockReturnValue((async function* streamText() {
        throw new AiProviderHttpError('unavailable', 503, 'gemini');
      })()),
    });
    const fallback = createProvider();
    const router = new AiRouterProvider([
      { name: 'gemini', provider: primary },
      { name: 'groq', provider: fallback },
    ], { name: 'openai', provider: createProvider() });
    const events: StreamTextEvent[] = [];

    for await (const event of router.streamText({ prompt: 'hello' })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'delta', text: 'generated' },
      {
        type: 'done',
        result: {
          text: 'generated',
          model: 'model-1',
          finishReason: 'stop',
        },
      },
    ]);
    expect(fallback.streamText).toHaveBeenCalledTimes(1);
  });

  it('does not fallback after streaming output has started', async () => {
    const primary = createProvider({
      streamText: jest.fn().mockReturnValue((async function* streamText() {
        yield { type: 'delta', text: 'partial' };
        throw new AiProviderHttpError('rate limited mid-stream', 429, 'gemini');
      })()),
    });
    const fallback = createProvider();
    const router = new AiRouterProvider([
      { name: 'gemini', provider: primary },
      { name: 'groq', provider: fallback },
    ], { name: 'openai', provider: createProvider() });
    const iterator = router.streamText({ prompt: 'hello' })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { type: 'delta', text: 'partial' },
    });
    await expect(iterator.next()).rejects.toThrow('rate limited mid-stream');
    expect(fallback.streamText).not.toHaveBeenCalled();
  });

  it('delegates embeddings to the configured embedding provider', async () => {
    const embeddingProvider = createProvider();
    const router = new AiRouterProvider([
      { name: 'gemini', provider: createProvider() },
    ], { name: 'openai', provider: embeddingProvider });

    await expect(router.embedText({ values: ['hello'] })).resolves.toEqual({
      embeddings: [[0.1, 0.2]],
      model: 'embedding-model',
    });
    expect(embeddingProvider.embedText).toHaveBeenCalledWith({ values: ['hello'] });
  });
});
