import { Inject, Injectable } from '@nestjs/common';
import { AI_CONFIG } from '../../../config/ai.config';
import type { AiConfig } from '../../../config/ai.config';
import type {
  EmbedTextInput,
  EmbedTextResult,
  GenerateTextInput,
  GenerateTextResult,
} from './app/ai.types';
import { AiProvider } from './app/ports/ai-provider';

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_CONFIG) private readonly aiConfig: AiConfig,
    private readonly aiProvider: AiProvider,
  ) {}

  async generateText(
    input: GenerateTextInput,
  ): Promise<GenerateTextResult> {
    return this.aiProvider.generateText({
      ...input,
      model: input.model ?? this.aiConfig.defaultTextModel,
    });
  }

  async embedText(input: EmbedTextInput): Promise<EmbedTextResult> {
    return this.aiProvider.embedText({
      ...input,
      model: input.model ?? this.aiConfig.defaultEmbeddingModel,
    });
  }
}
