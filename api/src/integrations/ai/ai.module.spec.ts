import type { AiConfig } from '~/platform/config/ai.config';
import { createAiProvider } from './ai.module';
import { FakeAiProvider } from './infra/fake-ai-provider';
import { NoopAiProvider } from './infra/noop-ai-provider';
import { OpenAiProvider } from './infra/openai-ai-provider';
import { AiRouterProvider } from './infra/ai-router-provider';

describe('createAiProvider', () => {
  const baseConfig: AiConfig = {
    driver: 'noop',
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
    openrouterBaseUrl: 'https://openrouter.ai/api/v1',
    openrouterDefaultTextModel: 'openai/gpt-oss-20b',
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

  it('selects the router provider when configured', () => {
    expect(createAiProvider({
      ...baseConfig,
      driver: 'router',
      openaiApiKey: 'openai-key',
      geminiApiKey: 'gemini-key',
      groqApiKey: 'groq-key',
      openrouterApiKey: 'openrouter-key',
    })).toBeInstanceOf(AiRouterProvider);
  });

  it('selects the noop provider when configured', () => {
    expect(createAiProvider(baseConfig)).toBeInstanceOf(NoopAiProvider);
  });
});
