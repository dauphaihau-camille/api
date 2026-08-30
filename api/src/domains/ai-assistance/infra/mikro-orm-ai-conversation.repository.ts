import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CurrentUserEntity } from '~/domains/auth/infra/persistence/entities/current-user.entity';
import { DocumentEntity } from '~/domains/document/infra/persistence/entities/document.entity';
import { buildCursorPaginationMeta } from '~/platform/application/cursor-pagination';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import type {
  AiChatTurnListRepositoryResult,
  AiChatTurnSummary,
  AiConversationGroup,
  AiConversationSessionListRepositoryResult,
  AiConversationSessionSummary,
  AiDocumentAttachment,
  AiResponseBlockPayload,
  AiResponseReservationRecord,
  AiResponseUsage,
  ListAiConversationSessionsQuery,
} from '../app/contracts/ai-assistance.contract';
import { AiConversationRepository } from '../app/ports/ai-conversation.repository';
import { AiChatTurnEntity } from './persistence/entities/ai-chat-turn.entity';
import { AiConversationSessionEntity } from './persistence/entities/ai-conversation-session.entity';
import { AiDocumentAttachmentEntity } from './persistence/entities/ai-document-attachment.entity';
import { AiResponseReservationEntity } from './persistence/entities/ai-response-reservation.entity';

@Injectable()
export class MikroOrmAiConversationRepository extends AiConversationRepository {
  constructor(private readonly entityManager: EntityManager) {
    super();
  }

  async listSessions(
    query: ListAiConversationSessionsQuery,
  ): Promise<AiConversationSessionListRepositoryResult> {
    const sessionRepository = this.entityManager.fork().getRepository(AiConversationSessionEntity);
    const normalizedQuery = query.q?.trim();

    const [sessions, total] = await sessionRepository.findAndCount(
      {
        workspace: query.workspaceId,
        user: query.userId,
        ...(normalizedQuery
          ? { title: { $ilike: `%${normalizedQuery}%` } }
          : {}),
      },
      {
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
        orderBy: { lastActivityAt: 'desc' },
      },
    );

    return {
      items: sessions.map((session) => this.toSessionSummary(session)),
      total,
    };
  }

  async findSession(input: {
    sessionId: string;
    workspaceId: string;
    userId: string;
  }): Promise<AiConversationSessionSummary | null> {
    const session = await this.entityManager.fork().findOne(AiConversationSessionEntity, {
      id: input.sessionId,
      workspace: input.workspaceId,
      user: input.userId,
    });

    return session ? this.toSessionSummary(session) : null;
  }

  async listTurns(input: {
    sessionId: string;
    workspaceId: string;
    userId: string;
    limit: number;
    cursor?: string;
  }): Promise<AiChatTurnListRepositoryResult> {
    const entityManager = this.entityManager.fork();

    const session = await entityManager.findOne(AiConversationSessionEntity, {
      id: input.sessionId,
      workspace: input.workspaceId,
      user: input.userId,
    });

    if (!session) {
      return {
        items: [],
        meta: buildCursorPaginationMeta(input.limit, false),
      };
    }

    const cursor = input.cursor ? this.decodeTurnCursor(input.cursor) : null;

    const turns = await entityManager.find(
      AiChatTurnEntity,
      {
        session,
        ...(cursor
          ? {
            $or: [
              { createdAt: { $lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { $lt: cursor.id } },
            ],
          }
          : {}),
      },
      {
        limit: input.limit + 1,
        orderBy: { createdAt: 'desc', id: 'desc' },
      },
    );

    const hasMore = turns.length > input.limit;
    const pageTurns = turns.slice(0, input.limit);

    const attachments = pageTurns.length === 0
      ? []
      : await entityManager.find(
        AiDocumentAttachmentEntity,
        {
          turn: { $in: pageTurns.map((turn) => turn.id) },
        },
        { populate: ['document'] },
      );

    const attachmentsByTurnId = new Map<string, AiDocumentAttachment[]>();

    for (const attachment of attachments) {
      const turnAttachments = attachmentsByTurnId.get(attachment.turn.id) ?? [];
      turnAttachments.push({
        documentId: attachment.document.id,
        title: attachment.title,
      });
      attachmentsByTurnId.set(attachment.turn.id, turnAttachments);
    }

    const items = pageTurns
      .toReversed()
      .map((turn) => this.toTurnSummary(
        turn,
        attachmentsByTurnId.get(turn.id) ?? [],
      ));
    const oldestTurn = pageTurns.at(-1);

    return {
      items,
      meta: buildCursorPaginationMeta(
        input.limit,
        hasMore,
        hasMore && oldestTurn ? this.encodeTurnCursor(oldestTurn) : undefined,
      ),
    };
  }

  async createSession(input: {
    workspaceId: string;
    userId: string;
  }): Promise<AiConversationSessionSummary> {
    const entityManager = this.entityManager.fork();

    const session = entityManager.create(AiConversationSessionEntity, {
      workspace: entityManager.getReference(WorkspaceEntity, input.workspaceId),
      user: entityManager.getReference(CurrentUserEntity, input.userId),
      lastActivityAt: new Date(),
    });

    await entityManager.persist(session).flush();

    return this.toSessionSummary(session);
  }

  async setSessionTitle(input: {
    sessionId: string;
    title: string;
  }): Promise<void> {
    const entityManager = this.entityManager.fork();
    const session = await entityManager.findOne(AiConversationSessionEntity, input.sessionId);

    if (!session || session.title) {
      return;
    }

    session.title = input.title;
    await entityManager.flush();
  }

  async createCompletedTurn(input: {
    sessionId: string;
    userMessage: string;
    assistantResponse: string;
    attachments: AiDocumentAttachment[];
    responseBlockPayload: AiResponseBlockPayload;
    metadata: Record<string, unknown>;
  }): Promise<AiChatTurnSummary> {
    const entityManager = this.entityManager.fork();
    const session = await entityManager.findOneOrFail(AiConversationSessionEntity, input.sessionId);

    const turn = entityManager.create(AiChatTurnEntity, {
      session,
      userMessage: input.userMessage,
      assistantResponse: input.assistantResponse,
      status: 'completed',
      responseBlockPayload: input.responseBlockPayload,
      metadata: input.metadata,
    });

    const attachments = input.attachments.map((attachment) => entityManager.create(
      AiDocumentAttachmentEntity,
      {
        turn,
        document: entityManager.getReference(DocumentEntity, attachment.documentId),
        title: attachment.title,
      },
    ));

    session.lastActivityAt = new Date();
    await entityManager.persist([turn, ...attachments]).flush();

    return this.toTurnSummary(turn, input.attachments);
  }

  async reserveTrialResponse(input: {
    workspaceId: string;
    allowance: number;
    expiresAt: Date;
    now: Date;
  }): Promise<AiResponseReservationRecord | null> {
    return this.entityManager.transactional(async (entityManager) => {
      await entityManager.getConnection().execute(
        'select pg_advisory_xact_lock(hashtext(?))',
        [input.workspaceId],
      );

      const consumed = await entityManager.count(AiResponseReservationEntity, {
        workspace: input.workspaceId,
        status: 'consumed',
      });
      const activeReservations = await entityManager.count(AiResponseReservationEntity, {
        workspace: input.workspaceId,
        status: 'reserved',
        expiresAt: { $gt: input.now },
      });

      if (consumed + activeReservations >= input.allowance) {
        return null;
      }

      const reservation = entityManager.create(AiResponseReservationEntity, {
        workspace: entityManager.getReference(WorkspaceEntity, input.workspaceId),
        expiresAt: input.expiresAt,
        status: 'reserved',
      });

      await entityManager.persist(reservation).flush();

      return this.toReservationRecord(reservation);
    });
  }

  async consumeReservation(reservationId: string): Promise<void> {
    const entityManager = this.entityManager.fork();
    const reservation = await entityManager.findOne(AiResponseReservationEntity, reservationId);

    if (!reservation || reservation.status !== 'reserved') {
      return;
    }

    reservation.status = 'consumed';
    await entityManager.flush();
  }

  async releaseReservation(reservationId: string): Promise<void> {
    const entityManager = this.entityManager.fork();
    const reservation = await entityManager.findOne(AiResponseReservationEntity, reservationId);

    if (!reservation || reservation.status !== 'reserved') {
      return;
    }

    reservation.status = 'released';
    await entityManager.flush();
  }

  async getTrialResponseUsage(input: {
    workspaceId: string;
    now: Date;
  }): Promise<AiResponseUsage> {
    const entityManager = this.entityManager.fork();
    const [usedResponses, reservedResponses] = await Promise.all([
      entityManager.count(AiResponseReservationEntity, {
        workspace: input.workspaceId,
        status: 'consumed',
      }),
      entityManager.count(AiResponseReservationEntity, {
        workspace: input.workspaceId,
        status: 'reserved',
        expiresAt: { $gt: input.now },
      }),
    ]);

    return {
      usedResponses,
      reservedResponses,
    };
  }

  private toSessionSummary(session: AiConversationSessionEntity): AiConversationSessionSummary {
    return {
      id: session.id,
      workspaceId: session.workspace.id,
      userId: session.user.id,
      title: session.title,
      group: this.toGroup(session.lastActivityAt),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private toTurnSummary(
    turn: AiChatTurnEntity,
    attachments: AiDocumentAttachment[],
  ): AiChatTurnSummary {
    return {
      id: turn.id,
      sessionId: turn.session.id,
      userMessage: turn.userMessage,
      assistantResponse: turn.assistantResponse,
      responseBlockPayload: turn.responseBlockPayload,
      status: turn.status,
      attachments,
      createdAt: turn.createdAt,
      updatedAt: turn.updatedAt,
    };
  }

  private toReservationRecord(reservation: AiResponseReservationEntity): AiResponseReservationRecord {
    return {
      id: reservation.id,
      workspaceId: reservation.workspace.id,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
    };
  }

  private encodeTurnCursor(turn: AiChatTurnEntity): string {
    return Buffer.from(JSON.stringify({
      createdAt: turn.createdAt.toISOString(),
      id: turn.id,
    })).toString('base64url');
  }

  private decodeTurnCursor(cursor: string): { createdAt: Date; id: string } | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
        createdAt?: unknown;
        id?: unknown;
      };

      if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
        return null;
      }

      const createdAt = new Date(parsed.createdAt);

      if (Number.isNaN(createdAt.getTime())) {
        return null;
      }

      return { createdAt, id: parsed.id };
    }
    catch {
      return null;
    }
  }

  private toGroup(lastActivityAt: Date): AiConversationGroup {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    return lastActivityAt.getTime() >= oneWeekAgo ? 'Past week' : 'Older';
  }
}
