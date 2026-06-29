import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AI_CONFIG, buildAiConfig } from '../../../config/ai.config';
import { AiProvider } from './app/ports/ai-provider';
import { AiService } from './ai.service';
import { NoopAiProvider } from './infra/noop-ai-provider';

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
      useFactory: (aiConfig: ReturnType<typeof buildAiConfig>) =>
        new NoopAiProvider(aiConfig),
    },
    AiService,
  ],
  exports: [AI_CONFIG, AiProvider, AiService],
})
export class AiModule {}
