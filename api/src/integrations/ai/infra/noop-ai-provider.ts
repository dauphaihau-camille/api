import { Injectable } from '@nestjs/common';
import type { AiConfig } from '~/platform/config/ai.config';
import { AiProvider } from '../app/ports/ai-provider';
import type {
  EmbedTextInput,
  EmbedTextResult,
  GenerateTextInput,
  GenerateTextResult,
} from '../app/ai.types';

@Injectable()
export class NoopAiProvider implements AiProvider {
  constructor(private readonly aiConfig: AiConfig) {}

  async generateText(
    input: GenerateTextInput,
  ): Promise<GenerateTextResult> {
    void input;
    throw new Error(
      `No AI text provider is configured. Replace NoopAiProvider and use model "${this.aiConfig.defaultTextModel}" as a starting default.`,
    );
  }

  async embedText(input: EmbedTextInput): Promise<EmbedTextResult> {
    void input;
    throw new Error(
      `No AI embedding provider is configured. Replace NoopAiProvider and use model "${this.aiConfig.defaultEmbeddingModel}" as a starting default.`,
    );
  }
}
