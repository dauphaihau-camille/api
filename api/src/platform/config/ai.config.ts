import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export type AiReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
export type AiModelProvider = 'openai' | 'anthropic' | 'moonshot';

export interface OpenAiModelOptions {
  reasoningEffort?: AiReasoningEffort;
}

export interface AnthropicModelOptions {
  thinkingBudgetTokens?: number;
}

export type MoonshotModelOptions = Record<string, never>;

export interface AiTextModelConfig {
  provider: AiModelProvider;
  providerModel: string;
  maxTokens?: number;
  openai?: OpenAiModelOptions;
  anthropic?: AnthropicModelOptions;
  moonshot?: MoonshotModelOptions;
}

export interface AiEmbeddingModelConfig {
  provider: AiModelProvider;
  providerModel: string;
  dimensions?: number;
  openai?: Record<string, never>;
  anthropic?: Record<string, never>;
  moonshot?: Record<string, never>;
}

export interface AiConfig {
  defaultTextModel: string;
  defaultEmbeddingModel: string;
  defaultReasoningEffort: AiReasoningEffort;
  defaultMaxTokens: number;
  textModels: Record<string, AiTextModelConfig>;
  embeddingModels: Record<string, AiEmbeddingModelConfig>;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
}

export const AI_CONFIG = Symbol('AI_CONFIG');

const reasoningEffortSchema = z.enum(['minimal', 'low', 'medium', 'high']);
const modelProviderSchema = z.enum(['openai', 'anthropic', 'moonshot']);

const textModelsSchema = z.record(
  z.string().trim().min(1),
  z.object({
    provider: modelProviderSchema,
    providerModel: z.string().trim().min(1),
    maxTokens: z.number().int().positive().optional(),
    openai: z.object({
      reasoningEffort: reasoningEffortSchema.optional(),
    }).strict().optional(),
    anthropic: z.object({
      thinkingBudgetTokens: z.number().int().positive().optional(),
    }).strict().optional(),
    moonshot: z.object({}).strict().optional(),
  }).strict(),
);

const embeddingModelsSchema = z.record(
  z.string().trim().min(1),
  z.object({
    provider: modelProviderSchema,
    providerModel: z.string().trim().min(1),
    dimensions: z.number().int().positive().optional(),
    openai: z.object({}).strict().optional(),
    anthropic: z.object({}).strict().optional(),
    moonshot: z.object({}).strict().optional(),
  }).strict(),
);

export function buildAiConfig(
  configService: Pick<ConfigService, 'get'>,
): AiConfig {
  return {
    defaultTextModel: configService.get<string>(
      'AI_DEFAULT_TEXT_MODEL',
      'openai:gpt-5.6',
    ),
    defaultEmbeddingModel: configService.get<string>(
      'AI_DEFAULT_EMBEDDING_MODEL',
      'openai:text-embedding-3-small',
    ),
    defaultReasoningEffort: configService.get<AiReasoningEffort>(
      'AI_DEFAULT_REASONING_EFFORT',
      'low',
    ),
    defaultMaxTokens: Number(configService.get<string>('AI_DEFAULT_MAX_TOKENS', '1200')),
    textModels: parseTextModelsConfig(configService.get<string>('AI_MODELS')),
    embeddingModels: parseEmbeddingModelsConfig(configService.get<string>('AI_EMBEDDING_MODELS')),
    openaiApiKey: configService.get<string>('OPENAI_API_KEY'),
    openaiBaseUrl: configService.get<string>('OPENAI_BASE_URL'),
  };
}

function parseTextModelsConfig(value?: string): Record<string, AiTextModelConfig> {
  if (!value) {
    return {};
  }

  try {
    return textModelsSchema.parse(JSON.parse(value));
  }
  catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid AI_MODELS config: ${error.message}`
        : 'Invalid AI_MODELS config.',
    );
  }
}

function parseEmbeddingModelsConfig(value?: string): Record<string, AiEmbeddingModelConfig> {
  if (!value) {
    return {};
  }

  try {
    return embeddingModelsSchema.parse(JSON.parse(value));
  }
  catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid AI_EMBEDDING_MODELS config: ${error.message}`
        : 'Invalid AI_EMBEDDING_MODELS config.',
    );
  }
}
