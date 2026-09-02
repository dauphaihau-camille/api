import Groq from 'groq-sdk';
import type { ChatCompletion, ChatCompletionChunk, ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
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

export type GroqClient = Pick<Groq, 'chat'>;

const GROQ_TIMEOUT_MS = 20_000;
const GROQ_MAX_RETRIES = 0;
const GROQ_MODEL_PREFIX = 'groq:';

export class GroqAiProvider implements AiProvider {
  private readonly client: GroqClient;

  constructor(
    private readonly aiConfig: AiConfig,
    client?: GroqClient,
  ) {
    this.client = client ?? new Groq({
      apiKey: requireConfig(aiConfig.groqApiKey, 'GROQ_API_KEY'),
      baseURL: normalizeGroqBaseUrl(aiConfig.groqBaseUrl),
      timeout: GROQ_TIMEOUT_MS,
      maxRetries: GROQ_MAX_RETRIES,
    });
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const model = this.resolveTextModel(input);

    const span = startAiProviderSpan({ provider: 'groq', operation: 'generate_text', model });

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: this.toChatMessages(input),
        temperature: input.temperature,
        max_tokens: input.maxTokens ?? this.aiConfig.defaultMaxTokens,
      });
      const result = this.toGenerateTextResult(response as ChatCompletion, model);

      span.endSuccess(result);
      return result;
    }
    catch (error) {
      const providerError = toProviderError(error, 'groq');
      span.endError(providerError);
      throw providerError;
    }
  }

  async *streamText(input: GenerateTextInput): AsyncIterable<StreamTextEvent> {
    const model = this.resolveTextModel(input);
    let stream: AsyncIterable<ChatCompletionChunk>;

    const span = startAiProviderSpan({ provider: 'groq', operation: 'stream_text', model });

    try {
      stream = await this.client.chat.completions.create({
        model,
        messages: this.toChatMessages(input),
        temperature: input.temperature,
        max_tokens: input.maxTokens ?? this.aiConfig.defaultMaxTokens,
        stream: true,
      }) as AsyncIterable<ChatCompletionChunk>;
    }
    catch (error) {
      const providerError = toProviderError(error, 'groq');
      span.endError(providerError);
      throw providerError;
    }

    let text = '';
    let responseModel = model;
    let finishReason: GenerateTextResult['finishReason'] = 'stop';

    try {
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const delta = choice?.delta.content;

        if (chunk.model) {
          responseModel = chunk.model;
        }

        if (choice?.finish_reason) {
          finishReason = this.toFinishReason(choice.finish_reason);
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
      const providerError = toProviderError(error, 'groq');
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
    throw new AiProviderUnsupportedOperationError('groq', 'embeddings');
  }

  private resolveTextModel(input: GenerateTextInput): string {
    if (input.model && input.model !== this.aiConfig.defaultTextModel) {
      const configuredModel = this.aiConfig.textModels[input.model];

      if (configuredModel && configuredModel.provider !== 'groq') {
        throw new Error(`Model "${input.model}" is configured for provider "${configuredModel.provider}", not Groq.`);
      }

      if (configuredModel) {
        return configuredModel.providerModel;
      }

      if (input.model.startsWith(GROQ_MODEL_PREFIX)) {
        return input.model.slice(GROQ_MODEL_PREFIX.length);
      }
    }

    return this.aiConfig.groqDefaultTextModel;
  }

  private toChatMessages(input: GenerateTextInput): ChatCompletionMessageParam[] {
    const messages = input.messages && input.messages.length > 0
      ? input.messages
      : [{ role: 'user' as const, content: input.prompt ?? '' }];

    return messages.map(toGroqMessage);
  }

  private toGenerateTextResult(
    response: ChatCompletion,
    fallbackModel: string,
  ): GenerateTextResult {
    return {
      text: response.choices[0]?.message.content ?? '',
      model: response.model ?? fallbackModel,
      finishReason: this.toFinishReason(response.choices[0]?.finish_reason),
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

function normalizeGroqBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/openai\/v\d+\/?$/, '');
}

function toGroqMessage(message: AiMessage): ChatCompletionMessageParam {
  return {
    role: message.role,
    content: message.content,
  };
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
