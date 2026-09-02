import type { AiConfig } from '~/platform/config/ai.config';
import type { StreamTextEvent } from '../app/ai.types';
import { GroqAiProvider, type GroqClient } from './groq-ai-provider';

type MockGroqClient = {
  chat: {
    completions: {
      create: jest.Mock;
    };
  };
};

describe('GroqAiProvider', () => {
  const aiConfig: AiConfig = {
    driver: 'groq',
    defaultTextModel: 'openai:gpt-5.6',
    defaultEmbeddingModel: 'openai:text-embedding-3-small',
    defaultReasoningEffort: 'low',
    defaultMaxTokens: 1200,
    textModels: {
      'groq:llama': {
        provider: 'groq',
        providerModel: 'llama-3.3-70b-versatile',
        maxTokens: 900,
        groq: {},
      },
    },
    embeddingModels: {},
    routerTextProviders: ['gemini', 'groq', 'openrouter'],
    routerEmbeddingProvider: 'openai',
    geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    geminiDefaultTextModel: 'gemini-2.5-flash',
    groqApiKey: 'groq-key',
    groqBaseUrl: 'https://api.groq.com',
    groqDefaultTextModel: 'openai/gpt-oss-20b',
    openrouterBaseUrl: 'https://openrouter.ai/api/v1',
    openrouterDefaultTextModel: 'openai/gpt-oss-20b',
    fakeStreamDelayMs: 0,
  };

  function createClient(): MockGroqClient {
    return {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            model: 'openai/gpt-oss-20b',
            choices: [{
              message: { content: 'Generated text' },
              finish_reason: 'stop',
            }],
          }),
        },
      },
    };
  }

  it('uses the Groq SDK for text generation', async () => {
    const client = createClient();
    const provider = new GroqAiProvider(aiConfig, client as unknown as GroqClient);

    await expect(provider.generateText({ prompt: 'Write summary' })).resolves.toEqual({
      text: 'Generated text',
      model: 'openai/gpt-oss-20b',
      finishReason: 'stop',
    });
    expect(client.chat.completions.create).toHaveBeenCalledWith({
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'user', content: 'Write summary' }],
      temperature: undefined,
      max_tokens: 1200,
    });
  });

  it('uses configured Groq model aliases', async () => {
    const client = createClient();
    const provider = new GroqAiProvider(aiConfig, client as unknown as GroqClient);

    await provider.generateText({
      model: 'groq:llama',
      prompt: 'Write summary',
    });

    expect(client.chat.completions.create).toHaveBeenCalledWith({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Write summary' }],
      temperature: undefined,
      max_tokens: 1200,
    });
  });

  it('streams Groq SDK chat completion deltas', async () => {
    const client = createClient();
    client.chat.completions.create.mockResolvedValue((async function* streamText() {
      yield {
        model: 'openai/gpt-oss-20b',
        choices: [{ delta: { content: 'Generated ' }, finish_reason: null }],
      };
      yield {
        model: 'openai/gpt-oss-20b',
        choices: [{ delta: { content: 'text' }, finish_reason: 'length' }],
      };
    })());
    const provider = new GroqAiProvider(aiConfig, client as unknown as GroqClient);
    const events: StreamTextEvent[] = [];

    for await (const event of provider.streamText({ prompt: 'Write summary' })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'delta', text: 'Generated ' },
      { type: 'delta', text: 'text' },
      {
        type: 'done',
        result: {
          text: 'Generated text',
          model: 'openai/gpt-oss-20b',
          finishReason: 'length',
        },
      },
    ]);
  });

  it('throws retryable HTTP errors for rate limits', async () => {
    const client = createClient();
    const error = new Error('rate limited') as Error & { status: number };
    error.status = 429;
    client.chat.completions.create.mockRejectedValue(error);
    const provider = new GroqAiProvider(aiConfig, client as unknown as GroqClient);

    await expect(provider.generateText({ prompt: 'Write summary' }))
      .rejects.toMatchObject({ status: 429, providerName: 'groq' });
  });
});
