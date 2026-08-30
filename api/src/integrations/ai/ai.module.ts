import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AI_CONFIG, buildAiConfig } from '~/platform/config/ai.config';
import { AiProvider } from './app/ports/ai-provider';
import { AiService } from './ai.service';
import type { AiConfig } from '~/platform/config/ai.config';
import { NoopAiProvider } from './infra/noop-ai-provider';
import { FakeAiProvider } from './infra/fake-ai-provider';
import { OpenAiProvider } from './infra/openai-ai-provider';

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

  return new NoopAiProvider(aiConfig);
}
