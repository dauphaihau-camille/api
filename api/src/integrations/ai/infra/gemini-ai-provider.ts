import { GoogleGenAI } from '@google/genai';
import type { Content, GenerateContentResponse } from '@google/genai';
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

type GeminiClient = Pick<GoogleGenAI, 'models'>;

const GEMINI_TIMEOUT_MS = 20_000;
const GEMINI_MODEL_PREFIX = 'gemini:';

export class GeminiAiProvider implements AiProvider {
  private readonly client: GeminiClient;

  constructor(
    private readonly aiConfig: AiConfig,
    client?: GeminiClient,
  ) {
    this.client = client ?? new GoogleGenAI({
      apiKey: requireConfig(aiConfig.geminiApiKey, 'GEMINI_API_KEY'),
      httpOptions: {
        baseUrl: normalizeGeminiBaseUrl(aiConfig.geminiBaseUrl),
        timeout: GEMINI_TIMEOUT_MS,
      },
    });
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const model = this.resolveTextModel(input);

    const span = startAiProviderSpan({ provider: 'gemini', operation: 'generate_text', model });

    try {
      const response = await this.client.models.generateContent({
        model,
        contents: this.toGeminiContents(input),
        config: {
          temperature: input.temperature,
          maxOutputTokens: input.maxTokens ?? this.aiConfig.defaultMaxTokens,
        },
      });
      const result = {
        text: response.text ?? '',
        model: response.modelVersion ?? model,
        finishReason: this.toFinishReason(response.candidates?.[0]?.finishReason),
      };

      span.endSuccess(result);
      return result;
    }
    catch (error) {
      const providerError = toProviderError(error, 'gemini');
      span.endError(providerError);
      throw providerError;
    }
  }

  async *streamText(input: GenerateTextInput): AsyncIterable<StreamTextEvent> {
    const model = this.resolveTextModel(input);
    let stream: AsyncGenerator<GenerateContentResponse>;

    const span = startAiProviderSpan({ provider: 'gemini', operation: 'stream_text', model });

    try {
      stream = await this.client.models.generateContentStream({
        model,
        contents: this.toGeminiContents(input),
        config: {
          temperature: input.temperature,
          maxOutputTokens: input.maxTokens ?? this.aiConfig.defaultMaxTokens,
        },
      });
    }
    catch (error) {
      const providerError = toProviderError(error, 'gemini');
      span.endError(providerError);
      throw providerError;
    }

    let text = '';
    let responseModel = model;
    let finishReason: GenerateTextResult['finishReason'] = 'stop';

    try {
      for await (const chunk of stream) {
        const delta = chunk.text ?? '';

        if (chunk.modelVersion) {
          responseModel = chunk.modelVersion;
        }

        if (chunk.candidates?.[0]?.finishReason) {
          finishReason = this.toFinishReason(chunk.candidates[0].finishReason);
        }

        if (delta.length > 0) {
          text += delta;
          yield {
            type: 'delta',
            text: delta,
          };
        }
      }
    }
    catch (error) {
      const providerError = toProviderError(error, 'gemini');
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
    throw new AiProviderUnsupportedOperationError('gemini', 'embeddings');
  }

  private resolveTextModel(input: GenerateTextInput): string {
    if (input.model && input.model !== this.aiConfig.defaultTextModel) {
      const configuredModel = this.aiConfig.textModels[input.model];

      if (configuredModel && configuredModel.provider !== 'gemini') {
        throw new Error(`Model "${input.model}" is configured for provider "${configuredModel.provider}", not Gemini.`);
      }

      if (configuredModel) {
        return configuredModel.providerModel;
      }

      if (input.model.startsWith(GEMINI_MODEL_PREFIX)) {
        return input.model.slice(GEMINI_MODEL_PREFIX.length);
      }
    }

    return this.aiConfig.geminiDefaultTextModel;
  }

  private toGeminiContents(input: GenerateTextInput): Content[] {
    const messages = input.messages && input.messages.length > 0
      ? input.messages
      : [{ role: 'user' as const, content: input.prompt ?? '' }];
    const contents: Content[] = [];
    const systemParts: string[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemParts.push(message.content);
        continue;
      }

      contents.push(toGeminiContent(message));
    }

    if (systemParts.length > 0) {
      contents.unshift({
        role: 'user',
        parts: [{ text: systemParts.join('\n') }],
      });
    }

    return contents;
  }

  private toFinishReason(reason?: string): GenerateTextResult['finishReason'] {
    if (reason === 'MAX_TOKENS') {
      return 'length';
    }

    if (reason === 'SAFETY' || reason === 'RECITATION' || reason === 'BLOCKLIST' || reason === 'PROHIBITED_CONTENT') {
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

function toGeminiContent(message: AiMessage): Content {
  return {
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  };
}

function normalizeGeminiBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/v\d+(?:beta|alpha)?\/?$/, '');
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
