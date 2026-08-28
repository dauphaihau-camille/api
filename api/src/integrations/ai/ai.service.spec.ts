import type { AiConfig } from '~/platform/config/ai.config';
import type { AiProvider } from './app/ports/ai-provider';
import { AiService } from './ai.service';

describe('AiService', () => {
  const aiConfig: AiConfig = {
    defaultTextModel: 'openai:gpt-5.6',
    defaultEmbeddingModel: 'openai:text-embedding-3-small',
    defaultReasoningEffort: 'low',
    defaultMaxTokens: 1200,
    textModels: {},
    embeddingModels: {},
  };

  function createProvider(): jest.Mocked<AiProvider> {
    return {
      generateText: jest.fn().mockResolvedValue({
        text: 'hello',
        model: 'gpt-5.6',
        finishReason: 'stop',
      }),
      streamText: jest.fn().mockReturnValue((async function* streamText() {
        yield { type: 'delta', text: 'hello' };
      })()),
      embedText: jest.fn().mockResolvedValue({
        embeddings: [[0.1, 0.2]],
        model: 'text-embedding-3-small',
      }),
    };
  }

  it('applies the default text model when none is supplied', async () => {
    const provider = createProvider();
    const service = new AiService(aiConfig, provider);

    await service.generateText({
      prompt: 'Summarize this.',
    });

    expect(provider.generateText).toHaveBeenCalledWith({
      prompt: 'Summarize this.',
      model: 'openai:gpt-5.6',
    });
  });

  it('applies the default text model for streaming when none is supplied', async () => {
    const provider = createProvider();
    const service = new AiService(aiConfig, provider);

    for await (const _event of service.streamText({
      prompt: 'Summarize this.',
    })) {
      // consume stream
    }

    expect(provider.streamText).toHaveBeenCalledWith({
      prompt: 'Summarize this.',
      model: 'openai:gpt-5.6',
    });
  });

  it('applies the default embedding model when none is supplied', async () => {
    const provider = createProvider();
    const service = new AiService(aiConfig, provider);

    await service.embedText({
      values: ['first', 'second'],
    });

    expect(provider.embedText).toHaveBeenCalledWith({
      values: ['first', 'second'],
      model: 'openai:text-embedding-3-small',
    });
  });
});
