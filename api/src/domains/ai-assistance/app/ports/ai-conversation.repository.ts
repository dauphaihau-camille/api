import type {
  AiChatTurnListRepositoryResult,
  AiChatTurnSummary,
  AiConversationSessionListRepositoryResult,
  AiConversationSessionSummary,
  AiDocumentAttachment,
  AiResponseBlockPayload,
  AiResponseReservationRecord,
  AiResponseUsage,
  ListAiConversationSessionsQuery,
} from '../contracts/ai-assistance.contract';

export abstract class AiConversationRepository {
  abstract listSessions(
    query: ListAiConversationSessionsQuery,
  ): Promise<AiConversationSessionListRepositoryResult>;

  abstract findSession(input: {
    sessionId: string;
    workspaceId: string;
    userId: string;
  }): Promise<AiConversationSessionSummary | null>;

  abstract listTurns(input: {
    sessionId: string;
    workspaceId: string;
    userId: string;
    limit: number;
    cursor?: string;
  }): Promise<AiChatTurnListRepositoryResult>;

  abstract createSession(input: {
    workspaceId: string;
    userId: string;
  }): Promise<AiConversationSessionSummary>;

  abstract setSessionTitle(input: {
    sessionId: string;
    title: string;
  }): Promise<void>;

  abstract createCompletedTurn(input: {
    sessionId: string;
    userMessage: string;
    assistantResponse: string;
    responseBlockPayload: AiResponseBlockPayload;
    attachments: AiDocumentAttachment[];
    metadata: Record<string, unknown>;
  }): Promise<AiChatTurnSummary>;

  abstract reserveTrialResponse(input: {
    workspaceId: string;
    allowance: number;
    expiresAt: Date;
    now: Date;
  }): Promise<AiResponseReservationRecord | null>;

  abstract consumeReservation(reservationId: string): Promise<void>;

  abstract releaseReservation(reservationId: string): Promise<void>;

  abstract getTrialResponseUsage(input: {
    workspaceId: string;
    now: Date;
  }): Promise<AiResponseUsage>;
}
