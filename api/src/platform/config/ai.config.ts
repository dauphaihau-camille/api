import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export type AiReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
export type AiTextProviderDriver = 'openai' | 'gemini' | 'groq' | 'openrouter';
export type AiEmbeddingProviderDriver = 'openai';
export type AiProviderDriver = AiTextProviderDriver | 'router' | 'fake' | 'noop';
export type AiModelProvider = AiTextProviderDriver | 'anthropic' | 'moonshot';

export interface OpenAiModelOptions {
  reasoningEffort?: AiReasoningEffort;
}

export interface AnthropicModelOptions {
  thinkingBudgetTokens?: number;
}

export type GeminiModelOptions = Record<string, never>;
export type GroqModelOptions = Record<string, never>;
export type OpenRouterModelOptions = Record<string, never>;
export type MoonshotModelOptions = Record<string, never>;

export interface AiTextModelConfig {
  provider: AiModelProvider;
  providerModel: string;
  maxTokens?: number;
  openai?: OpenAiModelOptions;
  anthropic?: AnthropicModelOptions;
  gemini?: GeminiModelOptions;
  groq?: GroqModelOptions;
  openrouter?: OpenRouterModelOptions;
  moonshot?: MoonshotModelOptions;
}

export interface AiEmbeddingModelConfig {
  provider: AiModelProvider;
  providerModel: string;
  dimensions?: number;
  openai?: Record<string, never>;
  anthropic?: Record<string, never>;
  gemini?: Record<string, never>;
  groq?: Record<string, never>;
  openrouter?: Record<string, never>;
  moonshot?: Record<string, never>;
}

export const DEFAULT_AI_PROVIDER_DRIVER: AiProviderDriver = 'noop';
export const DEFAULT_FAKE_STREAM_DELAY_MS = 40;

export interface AiConfig {
  driver: AiProviderDriver;
  defaultTextModel: string;
  defaultEmbeddingModel: string;
  defaultReasoningEffort: AiReasoningEffort;
  defaultMaxTokens: number;
  textModels: Record<string, AiTextModelConfig>;
  embeddingModels: Record<string, AiEmbeddingModelConfig>;
  routerTextProviders: AiTextProviderDriver[];
  routerEmbeddingProvider: AiEmbeddingProviderDriver;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  geminiApiKey?: string;
  geminiBaseUrl: string;
  geminiDefaultTextModel: string;
  groqApiKey?: string;
  groqBaseUrl: string;
  groqDefaultTextModel: string;
  openrouterApiKey?: string;
  openrouterBaseUrl: string;
  openrouterDefaultTextModel: string;
  fakeStreamDelayMs: number;
}

export const AI_CONFIG = Symbol('AI_CONFIG');

const reasoningEffortSchema = z.enum(['minimal', 'low', 'medium', 'high']);
const textProviderDriverSchema = z.enum(['openai', 'gemini', 'groq', 'openrouter']);
const embeddingProviderDriverSchema = z.enum(['openai']);
const providerDriverSchema = z.enum(['openai', 'gemini', 'groq', 'openrouter', 'router', 'fake', 'noop']);
const modelProviderSchema = z.enum(['openai', 'gemini', 'groq', 'openrouter', 'anthropic', 'moonshot']);

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
    gemini: z.object({}).strict().optional(),
    groq: z.object({}).strict().optional(),
    openrouter: z.object({}).strict().optional(),
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
    gemini: z.object({}).strict().optional(),
    groq: z.object({}).strict().optional(),
    openrouter: z.object({}).strict().optional(),
    moonshot: z.object({}).strict().optional(),
  }).strict(),
);

export function buildAiConfig(
  configService: Pick<ConfigService, 'get'>,
): AiConfig {
  return {
    driver: providerDriverSchema.parse(configService.get<string>(
      'AI_PROVIDER',
      configService.get<string>('OPENAI_API_KEY') ? 'openai' : DEFAULT_AI_PROVIDER_DRIVER,
    )),
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
    routerTextProviders: parseRouterTextProvidersConfig(configService.get<string>(
      'AI_ROUTER_TEXT_PROVIDERS',
      'gemini,groq,openrouter',
    )),
    routerEmbeddingProvider: embeddingProviderDriverSchema.parse(configService.get<string>(
      'AI_ROUTER_EMBEDDING_PROVIDER',
      'openai',
    )),
    openaiApiKey: configService.get<string>('OPENAI_API_KEY'),
    openaiBaseUrl: configService.get<string>('OPENAI_BASE_URL'),
    geminiApiKey: configService.get<string>('GEMINI_API_KEY'),
    geminiBaseUrl: configService.get<string>(
      'GEMINI_BASE_URL',
      'https://generativelanguage.googleapis.com',
    ),
    geminiDefaultTextModel: configService.get<string>(
      'GEMINI_DEFAULT_TEXT_MODEL',
      'gemini-3.6-flash',
    ),
    groqApiKey: configService.get<string>('GROQ_API_KEY'),
    groqBaseUrl: configService.get<string>(
      'GROQ_BASE_URL',
      'https://api.groq.com',
    ),
    groqDefaultTextModel: configService.get<string>(
      'GROQ_DEFAULT_TEXT_MODEL',
      'openai/gpt-oss-20b',
    ),
    openrouterApiKey: configService.get<string>('OPENROUTER_API_KEY'),
    openrouterBaseUrl: configService.get<string>(
      'OPENROUTER_BASE_URL',
      'https://openrouter.ai/api/v1',
    ),
    openrouterDefaultTextModel: configService.get<string>(
      'OPENROUTER_DEFAULT_TEXT_MODEL',
      'openai/gpt-oss-20b',
    ),
    fakeStreamDelayMs: parseNonNegativeIntegerConfig(
      configService.get<string>('AI_FAKE_STREAM_DELAY_MS'),
      DEFAULT_FAKE_STREAM_DELAY_MS,
      'AI_FAKE_STREAM_DELAY_MS',
    ),
  };
}

function parseRouterTextProvidersConfig(value: string): AiTextProviderDriver[] {
  const providers = value
    .split(',')
    .map((provider) => provider.trim())
    .filter((provider) => provider.length > 0);

  if (providers.length === 0) {
    throw new Error('AI_ROUTER_TEXT_PROVIDERS must include at least one provider.');
  }

  return providers.map((provider) => textProviderDriverSchema.parse(provider));
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

function parseNonNegativeIntegerConfig(
  value: string | undefined,
  defaultValue: number,
  name: string,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return parsedValue;
}
