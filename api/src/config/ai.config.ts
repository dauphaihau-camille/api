import type { ConfigService } from '@nestjs/config';

export interface AiConfig {
  driver: 'noop';
  defaultTextModel: string;
  defaultEmbeddingModel: string;
}

export const AI_CONFIG = Symbol('AI_CONFIG');

export function buildAiConfig(
  configService: Pick<ConfigService, 'get'>,
): AiConfig {
  return {
    driver: 'noop',
    defaultTextModel: configService.get<string>(
      'AI_DEFAULT_TEXT_MODEL',
      'general-text',
    ),
    defaultEmbeddingModel: configService.get<string>(
      'AI_DEFAULT_EMBEDDING_MODEL',
      'text-embedding',
    ),
  };
}
