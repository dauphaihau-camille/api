import type { AiConfig } from '~/platform/config/ai.config';
import type { AiProvider } from './app/ports/ai-provider';
import { AiService } from './ai.service';

describe('AiService', () => {
  const aiConfig: AiConfig = {
    driver: 'noop',
    defaultTextModel: 'general-text',
    defaultEmbeddingModel: 'text-embedding',
  };

  function createProvider(): jest.Mocked<AiProvider> {
    return {
      generateText: jest.fn().mockResolvedValue({
        text: 'hello',
        model: 'general-text',
        finishReason: 'stop',
      }),
      embedText: jest.fn().mockResolvedValue({
        embeddings: [[0.1, 0.2]],
        model: 'text-embedding',
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
      model: 'general-text',
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
      model: 'text-embedding',
    });
  });
});
