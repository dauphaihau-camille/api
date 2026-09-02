import type { OpenRouter } from '@openrouter/sdk';
import type { ChatMessages, ChatResult, ChatStreamChunk } from '@openrouter/sdk/models';
import type { AiConfig } from '~/platform/config/ai.config';
import type { AiProvider } from '../app/ports/ai-provider';
import type {
  AiMessage,
  EmbedTextInput,
  EmbedTextResult,
  GenerateTextInput,
  GenerateTextResult,
  StreamTextEvent,
} from '../app/ai.types';
import { AiProviderHttpError, AiProviderUnsupportedOperationError, extractErrorStatus } from './ai-provider-error';
import { startAiProviderSpan } from './ai-provider-telemetry';

type OpenRouterClient = Pick<OpenRouter, 'chat'>;

const OPENROUTER_TIMEOUT_MS = 20_000;
const OPENROUTER_MODEL_PREFIX = 'openrouter:';

export class OpenRouterAiProvider implements AiProvider {
  private client: OpenRouterClient | null;

  constructor(
    private readonly aiConfig: AiConfig,
    client?: OpenRouterClient,
  ) {
    this.client = client ?? null;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const model = this.resolveTextModel(input);

    const span = startAiProviderSpan({ provider: 'openrouter', operation: 'generate_text', model });

    try {
      const client = await this.getClient();
      const response = await client.chat.send({
        chatRequest: {
          model,
          messages: this.toChatMessages(input),
          temperature: input.temperature,
          maxTokens: input.maxTokens ?? this.aiConfig.defaultMaxTokens,
          metadata: input.metadata,
          stream: false,
        },
      });
      const result = this.toGenerateTextResult(response as ChatResult, model);

      span.endSuccess(result);
      return result;
    }
    catch (error) {
      const providerError = toProviderError(error, 'openrouter');
      span.endError(providerError);
      throw providerError;
    }
  }

  async *streamText(input: GenerateTextInput): AsyncIterable<StreamTextEvent> {
    const model = this.resolveTextModel(input);
    let stream: AsyncIterable<ChatStreamChunk>;

    const span = startAiProviderSpan({ provider: 'openrouter', operation: 'stream_text', model });

    try {
      const client = await this.getClient();
      stream = await client.chat.send({
        chatRequest: {
          model,
          messages: this.toChatMessages(input),
          temperature: input.temperature,
          maxTokens: input.maxTokens ?? this.aiConfig.defaultMaxTokens,
          metadata: input.metadata,
          stream: true,
        },
      }) as AsyncIterable<ChatStreamChunk>;
    }
    catch (error) {
      const providerError = toProviderError(error, 'openrouter');
      span.endError(providerError);
      throw providerError;
    }

    let text = '';
    let responseModel = model;
    let finishReason: GenerateTextResult['finishReason'] = 'stop';

    try {
      for await (const chunk of stream) {
        if (chunk.error) {
          throw new AiProviderHttpError(chunk.error.message, chunk.error.code, 'openrouter');
        }

        const choice = chunk.choices[0];
        const delta = choice?.delta.content;

        if (chunk.model) {
          responseModel = chunk.model;
        }

        if (choice?.finishReason) {
          finishReason = this.toFinishReason(choice.finishReason);
        }

        if (delta && delta.length > 0) {
          text += delta;
          yield {
            type: 'delta',
            text: delta,
          };
        }
      }
    }
    catch (error) {
      const providerError = toProviderError(error, 'openrouter');
      span.endError(providerError);
      throw providerError;
    }

    const result = {
      text,
      model: responseModel,
      finishReason,
    };

    span.endSuccess(result);
    yield {
      type: 'done',
      result,
    };
  }

  async embedText(input: EmbedTextInput): Promise<EmbedTextResult> {
    void input;
    throw new AiProviderUnsupportedOperationError('openrouter', 'embeddings');
  }

  private async getClient(): Promise<OpenRouterClient> {
    if (this.client) {
      return this.client;
    }

    // OpenRouter SDK is ESM-only; lazy import keeps the current Jest/CommonJS test runtime from loading ESM at module evaluation.
    const { OpenRouter: OpenRouterSdk } = await import('@openrouter/sdk');
    this.client = new OpenRouterSdk({
      apiKey: requireConfig(this.aiConfig.openrouterApiKey, 'OPENROUTER_API_KEY'),
      serverURL: this.aiConfig.openrouterBaseUrl,
      httpReferer: 'https://camille.app',
      appTitle: 'Camille',
      timeoutMs: OPENROUTER_TIMEOUT_MS,
    });

    return this.client;
  }

  private resolveTextModel(input: GenerateTextInput): string {
    if (input.model && input.model !== this.aiConfig.defaultTextModel) {
      const configuredModel = this.aiConfig.textModels[input.model];

      if (configuredModel && configuredModel.provider !== 'openrouter') {
        throw new Error(`Model "${input.model}" is configured for provider "${configuredModel.provider}", not OpenRouter.`);
      }

      if (configuredModel) {
        return configuredModel.providerModel;
      }

      if (input.model.startsWith(OPENROUTER_MODEL_PREFIX)) {
        return input.model.slice(OPENROUTER_MODEL_PREFIX.length);
      }
    }

    return this.aiConfig.openrouterDefaultTextModel;
  }

  private toChatMessages(input: GenerateTextInput): ChatMessages[] {
    const messages = input.messages && input.messages.length > 0
      ? input.messages
      : [{ role: 'user' as const, content: input.prompt ?? '' }];

    return messages.map(toOpenRouterMessage);
  }

  private toGenerateTextResult(
    response: ChatResult,
    fallbackModel: string,
  ): GenerateTextResult {
    return {
      text: resolveOpenRouterText(response.choices[0]?.message.content),
      model: response.model ?? fallbackModel,
      finishReason: this.toFinishReason(response.choices[0]?.finishReason),
    };
  }

  private toFinishReason(reason?: string | null): GenerateTextResult['finishReason'] {
    if (reason === 'length') {
      return 'length';
    }

    if (reason === 'content_filter') {
      return 'content_filter';
    }

    return 'stop';
  }
}

// ---------- Private helpers ----------

function requireConfig(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required when this AI provider is enabled.`);
  }

  return value;
}

function toOpenRouterMessage(message: AiMessage): ChatMessages {
  return {
    role: message.role,
    content: message.content,
  } as ChatMessages;
}

function resolveOpenRouterText(content: ChatResult['choices'][number]['message']['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  return '';
}

function toProviderError(error: unknown, providerName: string): unknown {
  const status = extractErrorStatus(error);

  if (status !== undefined) {
    return new AiProviderHttpError(
      error instanceof Error ? error.message : `${providerName} request failed`,
      status,
      providerName,
    );
  }

  return error;
}
