export type AiMessageRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

export interface GenerateTextInput {
  model?: string;
  prompt?: string;
  messages?: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, string>;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'other';
}

export type StreamTextEvent =
  | {
    type: 'delta';
    text: string;
  }
  | {
    type: 'done';
    result: GenerateTextResult;
  };

export interface EmbedTextInput {
  model?: string;
  values: string[];
}

export interface EmbedTextResult {
  embeddings: number[][];
  model: string;
}
