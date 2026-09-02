import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { hasMeaningfulContent } from '~/domains/document/app/utils/document-content.util';
import {
  type AiSourceDocument,
  DocumentDetailQueryRepository,
} from '~/domains/document/app/ports/document-detail-query.repository';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import { AiService } from '~/integrations/ai/ai.service';
import type { GenerateTextResult } from '~/integrations/ai/app/ai.types';
import type {
  AiChatTurnSummary,
  AiDocumentAttachment,
  AiResponseBlock,
  AiResponseBlockPayload,
  AiResponseInlineContent,
} from '../contracts/ai-assistance.contract';
import {
  AiResponseStreamNormalizer,
  normalizeCompletedAiResponse,
} from '../services/ai-response-normalizer';
import {
  AiContextSizeLimitExceededError,
  AiConversationSessionNotFoundError,
  AiDocumentAttachmentNotFoundError,
  AiDocumentAttachmentWorkspaceMismatchError,
  AiEmptyDocumentContentError,
  AiGenerationFailedError,
  AiWorkspaceNotFoundError,
} from '../errors/ai-assistance-app.error';
import { AiConversationRepository } from '../ports/ai-conversation.repository';
import { AiResponseGateService } from '../services/ai-response-gate.service';

const MAX_DIRECT_CONTEXT_CHARS = 24_000;
const MAX_SESSION_TITLE_CHARS = 60;

export type CreateAiChatTurnInput = {
  workspaceId: string;
  sessionId: string;
  message: string;
  documentIds: string[];
};

export type AiChatTurnStreamEvent =
  | {
    type: 'started';
    sessionId: string;
  }
  | {
    type: 'block_start';
    blockId: string;
    blockType: AiResponseBlock['type'];
    props?: AiResponseBlock['props'];
  }
  | {
    type: 'text_delta';
    blockId: string;
    content: AiResponseInlineContent[];
  }
  | {
    type: 'block_end';
    blockId: string;
  }
  | {
    type: 'done';
    turn: AiChatTurnSummary;
  };

type SourceDocument = AiDocumentAttachment & Pick<AiSourceDocument, 'content' | 'workspaceId'>;

type PreparedTurnRequest = {
  context: string;
  sourceDocuments: SourceDocument[];
};

@Injectable()
export class CreateAiChatTurnUseCase {
  private readonly logger = new Logger(CreateAiChatTurnUseCase.name);

  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly aiConversationRepository: AiConversationRepository,
    private readonly documentDetailQueryRepository: DocumentDetailQueryRepository,
    private readonly aiResponseGateService: AiResponseGateService,
    private readonly aiService: AiService,
  ) {}

  async execute(
    currentUser: AuthenticatedUser,
    input: CreateAiChatTurnInput,
  ): Promise<AiChatTurnSummary> {
    const request = await this.prepareTurnRequest(currentUser, input);
    const reservation = await this.aiResponseGateService.reserveResponse(input.workspaceId);
    let result: GenerateTextResult;

    try {
      result = await this.aiService.generateText({
        messages: this.buildMessages(input.message, request.context),
        metadata: this.buildMetadata(input, request.sourceDocuments),
      });
    }
    catch (error) {
      await this.aiResponseGateService.releaseReservation(reservation);
      this.logger.error(
        `AI text generation failed for workspace ${input.workspaceId} session ${input.sessionId}: ${formatAiGenerationError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new AiGenerationFailedError();
    }

    const turn = await this.persistCompletedTurn(input, request.sourceDocuments, result);

    await this.aiResponseGateService.consumeReservation(reservation);
    await this.setSessionTitle(input);

    return turn;
  }

  async *executeStream(
    currentUser: AuthenticatedUser,
    input: CreateAiChatTurnInput,
  ): AsyncIterable<AiChatTurnStreamEvent> {
    const request = await this.prepareTurnRequest(currentUser, input);
    const reservation = await this.aiResponseGateService.reserveResponse(input.workspaceId);
    let reservationSettled = false;
    let assistantResponse = '';
    const normalizer = new AiResponseStreamNormalizer();

    try {
      yield {
        type: 'started',
        sessionId: input.sessionId,
      };

      for await (const event of this.aiService.streamText({
        messages: this.buildMessages(input.message, request.context),
        metadata: this.buildMetadata(input, request.sourceDocuments),
      })) {
        if (event.type === 'delta') {
          assistantResponse += event.text;

          for (const blockEvent of normalizer.append(event.text)) {
            yield blockEvent;
          }

          continue;
        }

        const completion = normalizer.complete();

        for (const blockEvent of completion.events) {
          yield blockEvent;
        }
        const turn = await this.persistCompletedTurn(input, request.sourceDocuments, {
          ...event.result,
          text: assistantResponse || event.result.text,
        }, completion.payload);

        await this.aiResponseGateService.consumeReservation(reservation);
        reservationSettled = true;
        await this.setSessionTitle(input);

        yield {
          type: 'done',
          turn,
        };
      }
    }
    catch (error) {
      if (!reservationSettled) {
        await this.aiResponseGateService.releaseReservation(reservation);
        reservationSettled = true;
      }

      this.logger.error(
        `AI text streaming failed for workspace ${input.workspaceId} session ${input.sessionId}: ${formatAiGenerationError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new AiGenerationFailedError();
    }
    finally {
      if (!reservationSettled) {
        await this.aiResponseGateService.releaseReservation(reservation);
      }
    }
  }

  private async prepareTurnRequest(
    currentUser: AuthenticatedUser,
    input: CreateAiChatTurnInput,
  ): Promise<PreparedTurnRequest> {
    const access = await this.workspaceRepository.findWorkspaceAccess(
      input.workspaceId,
      currentUser.userId,
    );

    if (!access) {
      throw new AiWorkspaceNotFoundError();
    }

    const session = await this.aiConversationRepository.findSession({
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      userId: currentUser.userId,
    });

    if (!session) {
      throw new AiConversationSessionNotFoundError();
    }

    const sourceDocuments = await this.resolveSourceDocuments(currentUser, input);
    const context = this.buildSourceContext(sourceDocuments);

    if (context.length > MAX_DIRECT_CONTEXT_CHARS) {
      throw new AiContextSizeLimitExceededError();
    }

    return {
      context,
      sourceDocuments,
    };
  }

  private async resolveSourceDocuments(
    currentUser: AuthenticatedUser,
    input: CreateAiChatTurnInput,
  ): Promise<SourceDocument[]> {
    const documents = await this.documentDetailQueryRepository.findDocumentDetailsForAiSource({
      documentIds: input.documentIds,
      currentUser,
    });

    if (documents.length !== input.documentIds.length) {
      throw new AiDocumentAttachmentNotFoundError();
    }

    return documents.map((document) => {
      if (document.workspaceId !== input.workspaceId) {
        throw new AiDocumentAttachmentWorkspaceMismatchError();
      }

      if (!hasMeaningfulContent(document.content)) {
        throw new AiEmptyDocumentContentError();
      }

      return {
        documentId: document.id,
        workspaceId: document.workspaceId,
        title: document.title,
        content: document.content,
      };
    });
  }

  private buildMessages(message: string, context: string) {
    return [
      {
        role: 'system' as const,
        content: [
          'You are Camille AI, a concise workspace writing assistant.',
          'Use only the attached document context when document context is provided.',
          'Do not claim that hidden workspace retrieval was performed.',
          'Return document content as clean Markdown using headings, paragraphs, bullets, numbered lists, bold, and italic where useful.',
          'Do not wrap the response in a Markdown code fence.',
        ].join(' '),
      },
      ...(context.length > 0
        ? [{ role: 'user' as const, content: `Document context:\n${context}` }]
        : []),
      { role: 'user' as const, content: message },
    ];
  }

  private buildMetadata(
    input: CreateAiChatTurnInput,
    sourceDocuments: SourceDocument[],
  ): Record<string, string> {
    return {
      workspaceId: input.workspaceId,
      sessionId: input.sessionId,
      documentIds: sourceDocuments.map((document) => document.documentId).join(','),
    };
  }

  private async persistCompletedTurn(
    input: CreateAiChatTurnInput,
    sourceDocuments: SourceDocument[],
    result: GenerateTextResult,
    responseBlockPayload: AiResponseBlockPayload = normalizeCompletedAiResponse(result.text),
  ): Promise<AiChatTurnSummary> {
    return this.aiConversationRepository.createCompletedTurn({
      sessionId: input.sessionId,
      userMessage: input.message,
      assistantResponse: result.text,
      responseBlockPayload,
      attachments: sourceDocuments.map(({ documentId, title }) => ({ documentId, title })),
      metadata: {
        model: result.model,
        finishReason: result.finishReason,
      },
    });
  }

  private async setSessionTitle(input: CreateAiChatTurnInput): Promise<void> {
    await this.aiConversationRepository.setSessionTitle({
      sessionId: input.sessionId,
      title: input.message.slice(0, MAX_SESSION_TITLE_CHARS),
    });
  }

  private buildSourceContext(documents: SourceDocument[]): string {
    return documents.map((document) => [
      `Document: ${document.title}`,
      JSON.stringify(document.content),
    ].join('\n')).join('\n\n');
  }
}


// ---------- Private helpers ----------

function formatAiGenerationError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
