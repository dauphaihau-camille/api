import type { ConfigService } from '@nestjs/config';
import { buildAiConfig } from './ai.config';

describe('buildAiConfig', () => {
  function createConfigService(env: Record<string, string | undefined>): Pick<ConfigService, 'get'> {
    return {
      get: ((key: string | symbol, defaultValue?: unknown) =>
        env[String(key)] ?? defaultValue) as Pick<ConfigService, 'get'>['get'],
    };
  }

  it('defaults to OpenAI when OPENAI_API_KEY is set', () => {
    const config = buildAiConfig(createConfigService({
      OPENAI_API_KEY: 'openai-key',
    }));

    expect(config.driver).toBe('openai');
  });

  it('defaults to noop when OPENAI_API_KEY is not set', () => {
    const config = buildAiConfig(createConfigService({}));

    expect(config.driver).toBe('noop');
  });

  it('parses explicit fake provider settings', () => {
    const config = buildAiConfig(createConfigService({
      AI_PROVIDER: 'fake',
      AI_FAKE_STREAM_DELAY_MS: '0',
      OPENAI_API_KEY: 'openai-key',
    }));

    expect(config.driver).toBe('fake');
    expect(config.fakeStreamDelayMs).toBe(0);
  });


  it('parses provider-aware model defaults from AI_MODELS', () => {
    const config = buildAiConfig(createConfigService({
      AI_MODELS: JSON.stringify({
        'openai:gpt-5.6': {
          provider: 'openai',
          providerModel: 'gpt-5.6',
          maxTokens: 1200,
          openai: {
            reasoningEffort: 'medium',
          },
        },
        'openai:gpt-5.6-mini': {
          provider: 'openai',
          providerModel: 'gpt-5.6-mini',
          maxTokens: 800,
          openai: {
            reasoningEffort: 'minimal',
          },
        },
      }),
    }));

    expect(config.textModels).toEqual({
      'openai:gpt-5.6': {
        provider: 'openai',
        providerModel: 'gpt-5.6',
        maxTokens: 1200,
        openai: {
          reasoningEffort: 'medium',
        },
      },
      'openai:gpt-5.6-mini': {
        provider: 'openai',
        providerModel: 'gpt-5.6-mini',
        maxTokens: 800,
        openai: {
          reasoningEffort: 'minimal',
        },
      },
    });
  });

  it('parses provider-aware embedding defaults from AI_EMBEDDING_MODELS', () => {
    const config = buildAiConfig(createConfigService({
      AI_EMBEDDING_MODELS: JSON.stringify({
        'openai:text-embedding-3-small': {
          provider: 'openai',
          providerModel: 'text-embedding-3-small',
          dimensions: 1536,
          openai: {},
        },
      }),
    }));

    expect(config.embeddingModels).toEqual({
      'openai:text-embedding-3-small': {
        provider: 'openai',
        providerModel: 'text-embedding-3-small',
        dimensions: 1536,
        openai: {},
      },
    });
  });

  it('accepts provider-specific options for future providers', () => {
    const config = buildAiConfig(createConfigService({
      AI_MODELS: JSON.stringify({
        'anthropic:claude-sonnet-4.5': {
          provider: 'anthropic',
          providerModel: 'claude-sonnet-4.5',
          maxTokens: 1200,
          anthropic: {
            thinkingBudgetTokens: 1024,
          },
        },
        'moonshot:kimi-k2': {
          provider: 'moonshot',
          providerModel: 'kimi-k2',
          maxTokens: 1200,
          moonshot: {},
        },
      }),
    }));

    expect(config.textModels).toEqual({
      'anthropic:claude-sonnet-4.5': {
        provider: 'anthropic',
        providerModel: 'claude-sonnet-4.5',
        maxTokens: 1200,
        anthropic: {
          thinkingBudgetTokens: 1024,
        },
      },
      'moonshot:kimi-k2': {
        provider: 'moonshot',
        providerModel: 'kimi-k2',
        maxTokens: 1200,
        moonshot: {},
      },
    });
  });

  it('rejects invalid AI_MODELS JSON at config build time', () => {
    expect(() => buildAiConfig(createConfigService({
      AI_MODELS: '{"openai:gpt-5.6":{"provider":"openai","providerModel":"gpt-5.6","openai":{"reasoningEffort":"slow"}}}',
    }))).toThrow('Invalid AI_MODELS config');
  });

  it('rejects invalid AI_EMBEDDING_MODELS JSON at config build time', () => {
    expect(() => buildAiConfig(createConfigService({
      AI_EMBEDDING_MODELS: '{"openai:text-embedding-3-small":{"provider":"openai","providerModel":""}}',
    }))).toThrow('Invalid AI_EMBEDDING_MODELS config');
  });
});
