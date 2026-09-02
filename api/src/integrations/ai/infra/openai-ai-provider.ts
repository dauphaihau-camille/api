import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type {
  AiConfig,
  AiEmbeddingModelConfig,
  AiReasoningEffort,
  AiTextModelConfig,
} from '~/platform/config/ai.config';
import type {
  AiMessage,
  EmbedTextInput,
  EmbedTextResult,
  GenerateTextInput,
  GenerateTextResult,
  StreamTextEvent,
} from '../app/ai.types';
import { AiProvider } from '../app/ports/ai-provider';
import { startAiProviderSpan } from './ai-provider-telemetry';

export type OpenAiResponse = {
  output_text: string;
  model: string;
  error: { message?: string } | null;
  incomplete_details: { reason?: 'max_output_tokens' | 'content_filter' } | null;
};

export type OpenAiStreamEvent = {
  type: string;
  delta?: unknown;
};

export type OpenAiResponseStream = AsyncIterable<OpenAiStreamEvent> & {
  finalResponse(): Promise<OpenAiResponse>;
};

export type OpenAiEmbeddingResponse = {
  data: Array<{ embedding: number[] }>;
  model: string;
};

export type OpenAiClient = {
  responses: {
    create(input: {
      model: string;
      input: string | AiMessage[];
      temperature?: number;
      max_output_tokens?: number;
      metadata?: Record<string, string>;
      reasoning?: { effort: AiReasoningEffort };
    }): Promise<OpenAiResponse>;
    stream(input: {
      model: string;
      input: string | AiMessage[];
      temperature?: number;
      max_output_tokens?: number;
      metadata?: Record<string, string>;
      reasoning?: { effort: AiReasoningEffort };
    }): OpenAiResponseStream;
  };
  embeddings: {
    create(input: {
      model: string;
      input: string[];
      encoding_format: 'float';
    }): Promise<OpenAiEmbeddingResponse>;
  };
};

type ResolvedOpenAiTextModel = {
  providerModel: string;
  maxTokens: number;
  reasoningEffort: AiReasoningEffort;
};

type ResolvedOpenAiEmbeddingModel = {
  providerModel: string;
};

const OPENAI_TIMEOUT_MS = 10_000;
const OPENAI_MAX_RETRIES = 2;
const OPENAI_MODEL_PREFIX = 'openai:';

@Injectable()
export class OpenAiProvider implements AiProvider {
  private readonly openai: OpenAiClient;

  constructor(
    private readonly aiConfig: AiConfig,
    openaiClient?: OpenAiClient,
  ) {
    this.openai = openaiClient ?? new OpenAI({
      apiKey: requireConfig(aiConfig.openaiApiKey, 'OPENAI_API_KEY'),
      baseURL: aiConfig.openaiBaseUrl,
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: OPENAI_MAX_RETRIES,
    });
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const model = this.resolveTextModel(input);

    const span = startAiProviderSpan({ provider: 'openai', operation: 'generate_text', model: model.providerModel });

    try {
      const response = await this.openai.responses.create({
        model: model.providerModel,
        input: this.toOpenAiInput(input),
        temperature: input.temperature,
        max_output_tokens: input.maxTokens ?? model.maxTokens,
        metadata: input.metadata,
        reasoning: { effort: model.reasoningEffort },
      });

      if (response.error) {
        throw new Error(response.error.message ?? 'OpenAI text generation failed');
      }

      const result = this.toGenerateTextResult(response);
      span.endSuccess(result);
      return result;
    }
    catch (error) {
      span.endError(error);
      throw error;
    }
  }

  async *streamText(input: GenerateTextInput): AsyncIterable<StreamTextEvent> {
    const model = this.resolveTextModel(input);

    const span = startAiProviderSpan({ provider: 'openai', operation: 'stream_text', model: model.providerModel });

    try {
      const stream = this.openai.responses.stream({
        model: model.providerModel,
        input: this.toOpenAiInput(input),
        temperature: input.temperature,
        max_output_tokens: input.maxTokens ?? model.maxTokens,
        metadata: input.metadata,
        reasoning: { effort: model.reasoningEffort },
      });

      for await (const event of stream) {
        if (
          event.type === 'response.output_text.delta'
          && typeof event.delta === 'string'
        ) {
          yield {
            type: 'delta',
            text: event.delta,
          };
        }
      }

      const response = await stream.finalResponse();

      if (response.error) {
        throw new Error(response.error.message ?? 'OpenAI text generation failed');
      }

      const result = this.toGenerateTextResult(response);
      span.endSuccess(result);
      yield {
        type: 'done',
        result,
      };
    }
    catch (error) {
      span.endError(error);
      throw error;
    }
  }

  async embedText(input: EmbedTextInput): Promise<EmbedTextResult> {
    const model = this.resolveEmbeddingModel(input);

    const span = startAiProviderSpan({ provider: 'openai', operation: 'embed_text', model: model.providerModel });

    try {
      const response = await this.openai.embeddings.create({
        model: model.providerModel,
        input: input.values,
        encoding_format: 'float',
      });
      const result = {
        embeddings: response.data.map((item) => item.embedding),
        model: response.model,
      };

      span.endSuccess({ model: result.model });
      return result;
    }
    catch (error) {
      span.endError(error);
      throw error;
    }
  }

  private resolveTextModel(input: GenerateTextInput): ResolvedOpenAiTextModel {
    const modelId = input.model ?? this.aiConfig.defaultTextModel;
    const modelConfig = this.aiConfig.textModels[modelId] ??
      this.createFallbackModelConfig(modelId);

    if (modelConfig.provider !== 'openai') {
      throw new Error(`Model "${modelId}" is configured for provider "${modelConfig.provider}", not OpenAI.`);
    }

    return {
      providerModel: modelConfig.providerModel,
      maxTokens: modelConfig.maxTokens ?? this.aiConfig.defaultMaxTokens,
      reasoningEffort: modelConfig.openai?.reasoningEffort ??
        this.aiConfig.defaultReasoningEffort,
    };
  }

  private createFallbackModelConfig(modelId: string): AiTextModelConfig {
    const providerModel = modelId.startsWith(OPENAI_MODEL_PREFIX)
      ? modelId.slice(OPENAI_MODEL_PREFIX.length)
      : modelId;

    return {
      provider: 'openai',
      providerModel,
    };
  }

  private resolveEmbeddingModel(input: EmbedTextInput): ResolvedOpenAiEmbeddingModel {
    const modelId = input.model ?? this.aiConfig.defaultEmbeddingModel;
    const modelConfig = this.aiConfig.embeddingModels[modelId] ??
      this.createFallbackEmbeddingModelConfig(modelId);

    if (modelConfig.provider !== 'openai') {
      throw new Error(`Embedding model "${modelId}" is configured for provider "${modelConfig.provider}", not OpenAI.`);
    }

    return {
      providerModel: modelConfig.providerModel,
    };
  }

  private createFallbackEmbeddingModelConfig(modelId: string): AiEmbeddingModelConfig {
    const providerModel = modelId.startsWith(OPENAI_MODEL_PREFIX)
      ? modelId.slice(OPENAI_MODEL_PREFIX.length)
      : modelId;

    return {
      provider: 'openai',
      providerModel,
    };
  }

  private toOpenAiInput(input: GenerateTextInput): string | AiMessage[] {
    if (input.messages && input.messages.length > 0) {
      return input.messages;
    }

    return input.prompt ?? '';
  }

  private toGenerateTextResult(response: OpenAiResponse): GenerateTextResult {
    return {
      text: response.output_text,
      model: response.model,
      finishReason: this.toFinishReason(response.incomplete_details?.reason),
    };
  }

  private toFinishReason(
    reason?: 'max_output_tokens' | 'content_filter',
  ): GenerateTextResult['finishReason'] {
    if (reason === 'max_output_tokens') {
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
    throw new Error(`${name} is required to use OpenAI models`);
  }

  return value;
}
