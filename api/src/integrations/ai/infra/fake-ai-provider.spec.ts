import type { AiConfig } from '~/platform/config/ai.config';
import type { StreamTextEvent } from '../app/ai.types';
import { FakeAiProvider } from './fake-ai-provider';

describe('FakeAiProvider', () => {
  const aiConfig: AiConfig = {
    driver: 'fake',
    defaultTextModel: 'openai:gpt-5.6',
    defaultEmbeddingModel: 'openai:text-embedding-3-small',
    defaultReasoningEffort: 'low',
    defaultMaxTokens: 1200,
    textModels: {},
    embeddingModels: {},
    fakeStreamDelayMs: 0,
  };

  it('generates deterministic local text without an external client', async () => {
    const provider = new FakeAiProvider(aiConfig);

    await expect(provider.generateText({ prompt: 'Summarize this page' })).resolves.toEqual({
      text: expect.stringContaining('Prompt received: Summarize this page'),
      model: 'openai:gpt-5.6',
      finishReason: 'stop',
    });
  });

  it('streams deterministic deltas followed by the matching final result', async () => {
    const provider = new FakeAiProvider(aiConfig);
    const events: StreamTextEvent[] = [];

    for await (const event of provider.streamText({ prompt: 'Summarize this page' })) {
      events.push(event);
    }

    const deltas = events.filter((event) => event.type === 'delta');
    const done = events.at(-1);
    const streamedText = deltas
      .map((event) => event.text)
      .join('');

    expect(deltas.length).toBeGreaterThan(10);
    expect(streamedText).toContain('scroll anchoring');
    expect(streamedText).toContain('Prompt received: Summarize this page');
    expect(done).toEqual({
      type: 'done',
      result: {
        text: streamedText,
        model: 'openai:gpt-5.6',
        finishReason: 'stop',
      },
    });
  });

  it('returns deterministic embeddings with one vector per input', async () => {
    const provider = new FakeAiProvider(aiConfig);

    await expect(provider.embedText({ values: ['first', 'second'] })).resolves.toEqual({
      embeddings: [
        expect.arrayContaining([expect.any(Number)]),
        expect.arrayContaining([expect.any(Number)]),
      ],
      model: 'openai:text-embedding-3-small',
    });
  });
});
