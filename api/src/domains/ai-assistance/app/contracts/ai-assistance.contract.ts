import type { PaginatedResult } from '~/platform/application/pagination';
import type { CursorPaginatedResult } from '~/platform/application/cursor-pagination';

export type AiConversationGroup = 'Past week' | 'Older';

export type AiDocumentAttachment = {
  documentId: string;
  title: string;
};

export type AiResponseInlineContent = {
  type: 'text';
  text: string;
  styles?: {
    bold?: true;
    italic?: true;
  };
};

export type AiResponseBlock = {
  id: string;
  type: 'paragraph' | 'bulletListItem' | 'numberedListItem' | 'heading';
  content: AiResponseInlineContent[];
  props?: { level: number };
};

export type AiResponseBlockPayload = AiResponseBlock[];

export type AiChatTurnStatus = 'completed' | 'failed' | 'canceled';

export type AiConversationSessionSummary = {
  id: string;
  workspaceId: string;
  userId: string;
  title?: string;
  group: AiConversationGroup;
  createdAt: Date;
  updatedAt: Date;
};

export const AI_CONVERSATION_SESSION_LIST_DEFAULT_PAGE = 1;
export const AI_CONVERSATION_SESSION_LIST_DEFAULT_LIMIT = 20;
export const AI_CONVERSATION_SESSION_LIST_MAX_LIMIT = 100;

export type AiConversationSessionListResult = PaginatedResult<AiConversationSessionSummary>;

export type AiConversationSessionListRepositoryResult = {
  items: AiConversationSessionSummary[];
  total: number;
};

export type ListAiConversationSessionsQuery = {
  workspaceId: string;
  userId: string;
  page: number;
  limit: number;
  q?: string;
};

export type AiChatTurnSummary = {
  id: string;
  sessionId: string;
  userMessage: string;
  assistantResponse: string;
  responseBlockPayload: AiResponseBlockPayload;
  status: AiChatTurnStatus;
  attachments: AiDocumentAttachment[];
  createdAt: Date;
  updatedAt: Date;
};

export const AI_CHAT_TURN_LIST_DEFAULT_LIMIT = 50;
export const AI_CHAT_TURN_LIST_MAX_LIMIT = 100;

export type AiChatTurnListResult = CursorPaginatedResult<AiChatTurnSummary>;

export type AiChatTurnListRepositoryResult = CursorPaginatedResult<AiChatTurnSummary>;

export type AiResponseReservationRecord = {
  id: string;
  workspaceId: string;
  status: 'reserved' | 'consumed' | 'released';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AiResponseEntitlementSummary = {
  workspaceId: string;
  plan: string;
  allowance: number | null;
  usedResponses: number;
  reservedResponses: number;
  remainingResponses: number | null;
  limitReached: boolean;
  upgradeAvailable: boolean;
};

export type AiResponseUsage = {
  usedResponses: number;
  reservedResponses: number;
};
