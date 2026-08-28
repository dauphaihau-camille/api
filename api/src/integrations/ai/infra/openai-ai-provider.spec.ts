import type { AiConfig } from '~/platform/config/ai.config';
import type { StreamTextEvent } from '../app/ai.types';
import {
  OpenAiProvider,
  type OpenAiClient,
  type OpenAiResponse,
  type OpenAiStreamEvent,
} from './openai-ai-provider';

type MockOpenAiClient = {
  responses: {
    create: jest.MockedFunction<OpenAiClient['responses']['create']>;
    stream: jest.MockedFunction<OpenAiClient['responses']['stream']>;
  };
  embeddings: {
    create: jest.MockedFunction<OpenAiClient['embeddings']['create']>;
  };
};

function createStream(events: OpenAiStreamEvent[], response: OpenAiResponse) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
    finalResponse: jest.fn().mockResolvedValue(response),
  };
}

describe('OpenAiProvider', () => {
  const aiConfig: AiConfig = {
    defaultTextModel: 'openai:gpt-5.6',
    defaultEmbeddingModel: 'openai:text-embedding-3-small',
    defaultReasoningEffort: 'low',
    defaultMaxTokens: 1200,
    textModels: {
      'openai:gpt-5.6': {
        provider: 'openai',
        providerModel: 'gpt-5.6',
        maxTokens: 1200,
        openai: { reasoningEffort: 'low' },
      },
      'openai:gpt-5.6-mini': {
        provider: 'openai',
        providerModel: 'gpt-5.6-mini',
        maxTokens: 800,
        openai: { reasoningEffort: 'minimal' },
      },
    },
    embeddingModels: {
      'openai:text-embedding-3-small': {
        provider: 'openai',
        providerModel: 'text-embedding-3-small',
      },
    },
    openaiApiKey: 'openai-key',
  };

  function createClient(): MockOpenAiClient {
    return {
      responses: {
        create: jest.fn().mockResolvedValue({
          output_text: 'Generated text',
          model: 'gpt-5.6',
          error: null,
          incomplete_details: null,
        }),
        stream: jest.fn().mockReturnValue(createStream([
          { type: 'response.output_text.delta', delta: 'Generated ' },
          { type: 'response.output_text.delta', delta: 'text' },
        ], {
          output_text: 'Generated text',
          model: 'gpt-5.6',
          error: null,
          incomplete_details: null,
        })),
      },
      embeddings: {
        create: jest.fn().mockResolvedValue({
          data: [
            { embedding: [0.1, 0.2] },
            { embedding: [0.3, 0.4] },
          ],
          model: 'text-embedding-3-small',
        }),
      },
    };
  }

  it('uses OpenAI responses for text generation', async () => {
    const client = createClient();
    const provider = new OpenAiProvider(aiConfig, client);

    await expect(provider.generateText({
      messages: [{ role: 'user', content: 'Write summary' }],
      temperature: 0.2,
      maxTokens: 500,
      metadata: { workspaceId: 'workspace-1' },
    })).resolves.toEqual({
      text: 'Generated text',
      model: 'gpt-5.6',
      finishReason: 'stop',
    });
    expect(client.responses.create).toHaveBeenCalledWith({
      model: 'gpt-5.6',
      input: [{ role: 'user', content: 'Write summary' }],
      temperature: 0.2,
      max_output_tokens: 500,
      metadata: { workspaceId: 'workspace-1' },
      reasoning: { effort: 'low' },
    });
  });

  it('uses model-specific reasoning effort and token defaults', async () => {
    const client = createClient();
    const provider = new OpenAiProvider(aiConfig, client);

    await provider.generateText({
      model: 'openai:gpt-5.6-mini',
      prompt: 'Write summary',
    });

    expect(client.responses.create).toHaveBeenCalledWith({
      model: 'gpt-5.6-mini',
      input: 'Write summary',
      temperature: undefined,
      max_output_tokens: 800,
      metadata: undefined,
      reasoning: { effort: 'minimal' },
    });
  });

  it('rejects model configs owned by a different provider', async () => {
    const client = createClient();
    const provider = new OpenAiProvider({
      ...aiConfig,
      textModels: {
        ...aiConfig.textModels,
        'anthropic:claude-sonnet-4.5': {
          provider: 'anthropic',
          providerModel: 'claude-sonnet-4.5',
        },
      },
    }, client);

    await expect(provider.generateText({
      model: 'anthropic:claude-sonnet-4.5',
      prompt: 'Write summary',
    })).rejects.toThrow('not OpenAI');
  });

  it('streams OpenAI response deltas and final text result', async () => {
    const client = createClient();
    const provider = new OpenAiProvider(aiConfig, client);
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
          model: 'gpt-5.6',
          finishReason: 'stop',
        },
      },
    ]);
    expect(client.responses.stream).toHaveBeenCalledWith({
      model: 'gpt-5.6',
      input: 'Write summary',
      temperature: undefined,
      max_output_tokens: 1200,
      metadata: undefined,
      reasoning: { effort: 'low' },
    });
  });

  it('maps max output token incompletion to length finish reason', async () => {
    const client = createClient();
    client.responses.create.mockResolvedValue({
      output_text: 'Short text',
      model: 'gpt-5.6',
      error: null,
      incomplete_details: { reason: 'max_output_tokens' },
    });
    const provider = new OpenAiProvider(aiConfig, client);

    await expect(provider.generateText({ prompt: 'Write summary' })).resolves.toEqual({
      text: 'Short text',
      model: 'gpt-5.6',
      finishReason: 'length',
    });
  });

  it('throws when OpenAI returns a response error', async () => {
    const client = createClient();
    client.responses.create.mockResolvedValue({
      output_text: '',
      model: 'gpt-5.6',
      error: { message: 'blocked' },
      incomplete_details: null,
    });
    const provider = new OpenAiProvider(aiConfig, client);

    await expect(provider.generateText({ prompt: 'Write summary' }))
      .rejects.toThrow('blocked');
  });

  it('uses OpenAI embeddings for embedding generation', async () => {
    const client = createClient();
    const provider = new OpenAiProvider(aiConfig, client);

    await expect(provider.embedText({ values: ['first', 'second'] })).resolves.toEqual({
      embeddings: [[0.1, 0.2], [0.3, 0.4]],
      model: 'text-embedding-3-small',
    });
    expect(client.embeddings.create).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: ['first', 'second'],
      encoding_format: 'float',
    });
  });

  it('rejects embedding model configs owned by a different provider', async () => {
    const client = createClient();
    const provider = new OpenAiProvider({
      ...aiConfig,
      embeddingModels: {
        ...aiConfig.embeddingModels,
        'moonshot:kimi-embedding': {
          provider: 'moonshot',
          providerModel: 'kimi-embedding',
        },
      },
    }, client);

    await expect(provider.embedText({
      model: 'moonshot:kimi-embedding',
      values: ['first'],
    })).rejects.toThrow('not OpenAI');
  });
});
