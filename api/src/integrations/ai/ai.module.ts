import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AI_CONFIG, buildAiConfig } from '~/platform/config/ai.config';
import type { AiConfig, AiEmbeddingProviderDriver, AiTextProviderDriver } from '~/platform/config/ai.config';
import { AiProvider } from './app/ports/ai-provider';
import { AiService } from './ai.service';
import { NoopAiProvider } from './infra/noop-ai-provider';
import { FakeAiProvider } from './infra/fake-ai-provider';
import { OpenAiProvider } from './infra/openai-ai-provider';
import { AiRouterProvider } from './infra/ai-router-provider';
import { GeminiAiProvider } from './infra/gemini-ai-provider';
import { GroqAiProvider } from './infra/groq-ai-provider';
import { OpenRouterAiProvider } from './infra/openrouter-ai-provider';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: AI_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => buildAiConfig(configService),
    },
    {
      provide: AiProvider,
      inject: [AI_CONFIG],
      useFactory: createAiProvider,
    },
    AiService,
  ],
  exports: [AI_CONFIG, AiProvider, AiService],
})
export class AiModule {}

export function createAiProvider(aiConfig: AiConfig): AiProvider {
  if (aiConfig.driver === 'fake') {
    return new FakeAiProvider(aiConfig);
  }

  if (aiConfig.driver === 'openai') {
    return new OpenAiProvider(aiConfig);
  }

  if (aiConfig.driver === 'gemini') {
    return new GeminiAiProvider(aiConfig);
  }

  if (aiConfig.driver === 'groq') {
    return new GroqAiProvider(aiConfig);
  }

  if (aiConfig.driver === 'openrouter') {
    return new OpenRouterAiProvider(aiConfig);
  }

  if (aiConfig.driver === 'router') {
    return new AiRouterProvider(
      aiConfig.routerTextProviders.map((providerName) => ({
        name: providerName,
        provider: createTextProvider(providerName, aiConfig),
      })),
      {
        name: aiConfig.routerEmbeddingProvider,
        provider: createEmbeddingProvider(aiConfig.routerEmbeddingProvider, aiConfig),
      },
    );
  }

  return new NoopAiProvider(aiConfig);
}


// ---------- Private helpers ----------

function createTextProvider(
  providerName: AiTextProviderDriver,
  aiConfig: AiConfig,
): AiProvider {
  if (providerName === 'openai') {
    return new OpenAiProvider(aiConfig);
  }

  if (providerName === 'gemini') {
    return new GeminiAiProvider(aiConfig);
  }

  if (providerName === 'groq') {
    return new GroqAiProvider(aiConfig);
  }

  return new OpenRouterAiProvider(aiConfig);
}

function createEmbeddingProvider(
  providerName: AiEmbeddingProviderDriver,
  aiConfig: AiConfig,
): AiProvider {
  if (providerName === 'openai') {
    return new OpenAiProvider(aiConfig);
  }

  throw new Error(`Unsupported AI embedding provider: ${providerName}`);
}
