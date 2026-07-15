import type {
  EmbedTextInput,
  EmbedTextResult,
  GenerateTextInput,
  GenerateTextResult,
} from '../ai.types';

export abstract class AiProvider {
  abstract generateText(
    input: GenerateTextInput
  ): Promise<GenerateTextResult>;

  abstract embedText(input: EmbedTextInput): Promise<EmbedTextResult>;
}
