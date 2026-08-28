import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AI_CONFIG, buildAiConfig } from '~/platform/config/ai.config';
import { AiProvider } from './app/ports/ai-provider';
import { AiService } from './ai.service';
import type { AiConfig } from '~/platform/config/ai.config';
import { NoopAiProvider } from './infra/noop-ai-provider';
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
      useFactory: (aiConfig: AiConfig) =>
        aiConfig.openaiApiKey
          ? new OpenAiProvider(aiConfig)
          : new NoopAiProvider(aiConfig),
    },
    AiService,
  ],
  exports: [AI_CONFIG, AiProvider, AiService],
})
export class AiModule {}
