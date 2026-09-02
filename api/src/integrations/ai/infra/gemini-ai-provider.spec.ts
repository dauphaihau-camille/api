import type { GoogleGenAI } from '@google/genai';
import type { AiConfig } from '~/platform/config/ai.config';
import type { StreamTextEvent } from '../app/ai.types';
import { GeminiAiProvider } from './gemini-ai-provider';

type GeminiClient = Pick<GoogleGenAI, 'models'>;
type MockGeminiClient = {
  models: {
    generateContent: jest.Mock;
    generateContentStream: jest.Mock;
  };
};


describe('GeminiAiProvider', () => {
  const aiConfig: AiConfig = {
    driver: 'gemini',
    defaultTextModel: 'gemini:gemini-2.5-flash',
    defaultEmbeddingModel: 'openai:text-embedding-3-small',
    defaultReasoningEffort: 'low',
    defaultMaxTokens: 1200,
    textModels: {},
    embeddingModels: {},
    routerTextProviders: ['gemini', 'groq', 'openrouter'],
    routerEmbeddingProvider: 'openai',
    geminiApiKey: 'gemini-key',
    geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    geminiDefaultTextModel: 'gemini-2.5-flash',
    groqBaseUrl: 'https://api.groq.com',
    groqDefaultTextModel: 'openai/gpt-oss-20b',
    openrouterBaseUrl: 'https://openrouter.ai/api/v1',
    openrouterDefaultTextModel: 'openai/gpt-oss-20b',
    fakeStreamDelayMs: 0,
  };

  function createClient(): MockGeminiClient {
    return {
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: 'Generated text',
          modelVersion: 'gemini-2.5-flash',
          candidates: [{ finishReason: 'STOP' }],
        }),
        generateContentStream: jest.fn().mockResolvedValue((async function* streamText() {
          yield {
            text: 'Generated ',
            modelVersion: 'gemini-2.5-flash',
          };
          yield {
            text: 'text',
            candidates: [{ finishReason: 'MAX_TOKENS' }],
          };
        })()),
      },
    };
  }

  it('uses the Google GenAI SDK for text generation', async () => {
    const client = createClient();
    const provider = new GeminiAiProvider(aiConfig, client as unknown as GeminiClient);

    await expect(provider.generateText({
      messages: [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Write summary' },
      ],
      temperature: 0.2,
      maxTokens: 500,
    })).resolves.toEqual({
      text: 'Generated text',
      model: 'gemini-2.5-flash',
      finishReason: 'stop',
    });
    expect(client.models.generateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: 'Be concise.' }] },
        { role: 'user', parts: [{ text: 'Write summary' }] },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 500,
      },
    });
  });

  it('streams Google GenAI SDK response text deltas', async () => {
    const client = createClient();
    const provider = new GeminiAiProvider(aiConfig, client as unknown as GeminiClient);
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
          model: 'gemini-2.5-flash',
          finishReason: 'length',
        },
      },
    ]);
  });

  it('throws retryable HTTP errors for rate limits', async () => {
    const client = createClient();
    const error = new Error('quota exceeded') as Error & { status: number };
    error.status = 429;
    client.models.generateContent.mockRejectedValue(error);
    const provider = new GeminiAiProvider(aiConfig, client as unknown as GeminiClient);

    await expect(provider.generateText({ prompt: 'Write summary' }))
      .rejects.toMatchObject({ status: 429, providerName: 'gemini' });
  });
});
