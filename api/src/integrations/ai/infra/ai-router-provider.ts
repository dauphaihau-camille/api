import type { AiEmbeddingProviderDriver, AiTextProviderDriver } from '~/platform/config/ai.config';
import type { AiProvider } from '../app/ports/ai-provider';
import type {
  EmbedTextInput,
  EmbedTextResult,
  GenerateTextInput,
  GenerateTextResult,
  StreamTextEvent,
} from '../app/ai.types';
import { isTransientAiProviderError } from './ai-provider-error';

type TextProviderEntry = {
  name: AiTextProviderDriver;
  provider: AiProvider;
};

type EmbeddingProviderEntry = {
  name: AiEmbeddingProviderDriver;
  provider: AiProvider;
};

export class AiRouterProvider implements AiProvider {
  constructor(
    private readonly textProviders: TextProviderEntry[],
    private readonly embeddingProvider: EmbeddingProviderEntry,
  ) {
    if (textProviders.length === 0) {
      throw new Error('AI router requires at least one text provider.');
    }
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const errors: Error[] = [];

    for (const entry of this.textProviders) {
      try {
        return await entry.provider.generateText(input);
      }
      catch (error) {
        if (!isTransientAiProviderError(error)) {
          throw error;
        }

        errors.push(toError(error));
      }
    }

    throw new Error(this.toExhaustedMessage('text generation', errors));
  }

  async *streamText(input: GenerateTextInput): AsyncIterable<StreamTextEvent> {
    const errors: Error[] = [];

    for (const entry of this.textProviders) {
      let yielded = false;

      try {
        for await (const event of entry.provider.streamText(input)) {
          yielded = true;
          yield event;
        }

        return;
      }
      catch (error) {
        if (yielded || !isTransientAiProviderError(error)) {
          throw error;
        }

        errors.push(toError(error));
      }
    }

    throw new Error(this.toExhaustedMessage('streaming text generation', errors));
  }

  async embedText(input: EmbedTextInput): Promise<EmbedTextResult> {
    return this.embeddingProvider.provider.embedText(input);
  }

  private toExhaustedMessage(operation: string, errors: Error[]): string {
    const providerNames = this.textProviders
      .map((entry) => entry.name)
      .join(', ');
    const details = errors
      .map((error) => error.message)
      .join('; ');

    return details.length > 0
      ? `AI router exhausted ${operation} providers (${providerNames}): ${details}`
      : `AI router exhausted ${operation} providers (${providerNames}).`;
  }
}

// ---------- Private helpers ----------

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
