import type { AiConfig } from '~/platform/config/ai.config';
import { createAiProvider } from './ai.module';
import { FakeAiProvider } from './infra/fake-ai-provider';
import { NoopAiProvider } from './infra/noop-ai-provider';
import { OpenAiProvider } from './infra/openai-ai-provider';

describe('createAiProvider', () => {
  const baseConfig: AiConfig = {
    driver: 'noop',
    defaultTextModel: 'openai:gpt-5.6',
    defaultEmbeddingModel: 'openai:text-embedding-3-small',
    defaultReasoningEffort: 'low',
    defaultMaxTokens: 1200,
    textModels: {},
    embeddingModels: {},
    fakeStreamDelayMs: 0,
  };

  it('selects the fake provider when configured', () => {
    expect(createAiProvider({
      ...baseConfig,
      driver: 'fake',
    })).toBeInstanceOf(FakeAiProvider);
  });

  it('selects the OpenAI provider when configured', () => {
    expect(createAiProvider({
      ...baseConfig,
      driver: 'openai',
      openaiApiKey: 'openai-key',
    })).toBeInstanceOf(OpenAiProvider);
  });

  it('selects the noop provider when configured', () => {
    expect(createAiProvider(baseConfig)).toBeInstanceOf(NoopAiProvider);
  });
});
