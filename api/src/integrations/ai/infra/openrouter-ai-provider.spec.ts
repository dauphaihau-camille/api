import type { AiConfig } from '~/platform/config/ai.config';
import type { StreamTextEvent } from '../app/ai.types';
import { OpenRouterAiProvider } from './openrouter-ai-provider';

type OpenRouterClient = ConstructorParameters<typeof OpenRouterAiProvider>[1];
type MockOpenRouterClient = {
  chat: {
    send: jest.Mock;
  };
};


describe('OpenRouterAiProvider', () => {
  const aiConfig: AiConfig = {
    driver: 'openrouter',
    defaultTextModel: 'openai:gpt-5.6',
    defaultEmbeddingModel: 'openai:text-embedding-3-small',
    defaultReasoningEffort: 'low',
    defaultMaxTokens: 1200,
    textModels: {},
    embeddingModels: {},
    routerTextProviders: ['gemini', 'groq', 'openrouter'],
    routerEmbeddingProvider: 'openai',
    geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    geminiDefaultTextModel: 'gemini-2.5-flash',
    groqBaseUrl: 'https://api.groq.com',
    groqDefaultTextModel: 'openai/gpt-oss-20b',
    openrouterApiKey: 'openrouter-key',
    openrouterBaseUrl: 'https://openrouter.ai/api/v1',
    openrouterDefaultTextModel: 'openai/gpt-oss-20b',
    fakeStreamDelayMs: 0,
  };

  function createClient(): MockOpenRouterClient {
    return {
      chat: {
        send: jest.fn().mockResolvedValue({
          model: 'openai/gpt-oss-20b',
          choices: [{
            message: { content: 'Generated text' },
            finishReason: 'stop',
          }],
        }),
      },
    };
  }

  it('uses the OpenRouter SDK for text generation', async () => {
    const client = createClient();
    const provider = new OpenRouterAiProvider(aiConfig, client as unknown as OpenRouterClient);

    await expect(provider.generateText({
      prompt: 'Write summary',
      metadata: { workspaceId: 'workspace-1' },
    })).resolves.toEqual({
      text: 'Generated text',
      model: 'openai/gpt-oss-20b',
      finishReason: 'stop',
    });
    expect(client.chat.send).toHaveBeenCalledWith({
      chatRequest: {
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: 'Write summary' }],
        temperature: undefined,
        maxTokens: 1200,
        metadata: { workspaceId: 'workspace-1' },
        stream: false,
      },
    });
  });

  it('streams OpenRouter SDK chat completion deltas', async () => {
    const client = createClient();
    client.chat.send.mockResolvedValue((async function* streamText() {
      yield {
        model: 'openai/gpt-oss-20b',
        choices: [{ delta: { content: 'Generated ' }, finishReason: null }],
      };
      yield {
        model: 'openai/gpt-oss-20b',
        choices: [{ delta: { content: 'text' }, finishReason: 'length' }],
      };
    })());
    const provider = new OpenRouterAiProvider(aiConfig, client as unknown as OpenRouterClient);
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
    const error = new Error('rate limited') as Error & { statusCode: number };
    error.statusCode = 429;
    client.chat.send.mockRejectedValue(error);
    const provider = new OpenRouterAiProvider(aiConfig, client as unknown as OpenRouterClient);

    await expect(provider.generateText({ prompt: 'Write summary' }))
      .rejects.toMatchObject({ status: 429, providerName: 'openrouter' });
  });
});
