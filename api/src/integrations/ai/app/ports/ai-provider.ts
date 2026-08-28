import type {
  EmbedTextInput,
  EmbedTextResult,
  GenerateTextInput,
  GenerateTextResult,
  StreamTextEvent,
} from '../ai.types';

export abstract class AiProvider {
  abstract generateText(
    input: GenerateTextInput
  ): Promise<GenerateTextResult>;

  abstract streamText(input: GenerateTextInput): AsyncIterable<StreamTextEvent>;

  abstract embedText(input: EmbedTextInput): Promise<EmbedTextResult>;
}
