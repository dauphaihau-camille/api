import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import type { DocumentDetailQueryRepository } from '~/domains/document/app/ports/document-detail-query.repository';
import type { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import { WorkspaceRole } from '~/domains/workspace/domain/enums/workspace-role.enum';
import type { AiService } from '~/integrations/ai/ai.service';
import { SubscriptionPlan } from '~/domains/subscription/domain/enums/subscription-plan.enum';
import { SubscriptionStatus } from '~/domains/subscription/domain/enums/subscription-status.enum';
import type { SubscriptionSummaryService } from '~/domains/subscription/app/services/subscription-summary.service';
import {
  AiDocumentAttachmentNotFoundError,
  AiResponseEntitlementDeniedError,
} from '../errors/ai-assistance-app.error';
import type { AiConversationRepository } from '../ports/ai-conversation.repository';
import { AiResponseGateService } from '../services/ai-response-gate.service';
import {
  CreateAiChatTurnUseCase,
  type AiChatTurnStreamEvent,
} from './create-ai-chat-turn.use-case';
import { GetAiResponseEntitlementUseCase } from './get-ai-response-entitlement.use-case';
import { ListAiChatTurnsUseCase } from './list-ai-chat-turns.use-case';
import {
  CreateAiConversationSessionUseCase,
  ListAiConversationSessionsUseCase,
} from './session.use-cases';

describe('AI assistance use cases', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  const sessionSummary = {
    id: 'ai-session-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    title: undefined,
    group: 'Past week' as const,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  function createWorkspaceRepository() {
    return {
      findWorkspaceAccess: jest.fn().mockResolvedValue({
        workspace: {
          id: 'workspace-1',
          version: 1,
          slug: 'workspace-1',
          name: 'Workspace 1',
          currentUserRole: WorkspaceRole.MEMBER,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        membership: {
          id: 'membership-1',
          userId: 'user-1',
          email: 'user@example.com',
          role: WorkspaceRole.MEMBER,
          joinedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      }),
    } as unknown as jest.Mocked<WorkspaceRepository>;
  }

  function createAiConversationRepository() {
    return {
      listSessions: jest.fn().mockResolvedValue({
        items: [sessionSummary],
        total: 25,
      }),
      findSession: jest.fn().mockResolvedValue(sessionSummary),
      listTurns: jest.fn().mockResolvedValue({
        items: [{
          id: 'turn-1',
          sessionId: 'ai-session-1',
          userMessage: 'Summarize this',
          assistantResponse: 'Summary',
          responseBlockPayload: [{
            id: 'ai-block-1',
            type: 'paragraph',
            content: [{ type: 'text', text: 'Summary' }],
          }],
          status: 'completed',
          attachments: [{ documentId: 'document-1', title: 'Doc 1' }],
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        }],
        meta: {
          limit: 20,
          nextCursor: 'cursor-1',
          hasMore: true,
        },
      }),
      createSession: jest.fn().mockResolvedValue(sessionSummary),
      setSessionTitle: jest.fn().mockResolvedValue(undefined),
      createCompletedTurn: jest.fn().mockResolvedValue({
        id: 'turn-1',
        sessionId: 'ai-session-1',
        userMessage: 'Summarize this',
        assistantResponse: 'Summary',
        responseBlockPayload: [{
          id: 'ai-block-1',
          type: 'paragraph',
          content: [{ type: 'text', text: 'Summary' }],
        }],
        status: 'completed',
        attachments: [{ documentId: 'document-1', title: 'Doc 1' }],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      reserveTrialResponse: jest.fn().mockResolvedValue({
        id: 'reservation-1',
        workspaceId: 'workspace-1',
        status: 'reserved',
        expiresAt: new Date('2026-01-01T00:10:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      consumeReservation: jest.fn().mockResolvedValue(undefined),
      releaseReservation: jest.fn().mockResolvedValue(undefined),
      getTrialResponseUsage: jest.fn().mockResolvedValue({
        usedResponses: 3,
        reservedResponses: 1,
      }),
    } as unknown as jest.Mocked<AiConversationRepository>;
  }

  function createSubscriptionSummaryService(plan = SubscriptionPlan.FREE) {
    return {
      getSummary: jest.fn().mockResolvedValue({
        workspaceId: 'workspace-1',
        plan,
        status: plan === SubscriptionPlan.FREE ? SubscriptionStatus.FREE : SubscriptionStatus.ACTIVE,
        seatCount: 2,
        blockCount: 0,
        blockLimit: null,
        entitlements: { maxBlocks: null },
        cancelAtPeriodEnd: false,
      }),
    } as unknown as jest.Mocked<SubscriptionSummaryService>;
  }

  function createDocumentDetailQueryRepository() {
    return {
      findDocumentDetailsForAiSource: jest.fn().mockResolvedValue([{
        id: 'document-1',
        workspaceId: 'workspace-1',
        title: 'Doc 1',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Useful text' }] }],
      }]),
    } as unknown as jest.Mocked<DocumentDetailQueryRepository>;
  }

  function createAiService() {
    return {
      generateText: jest.fn().mockResolvedValue({
        text: 'Summary',
        model: 'test-model',
        finishReason: 'stop',
      }),
      streamText: jest.fn().mockReturnValue((async function* streamText() {
        yield { type: 'delta', text: 'Sum' };
        yield { type: 'delta', text: 'mary' };
        yield {
          type: 'done',
          result: {
            text: 'Summary',
            model: 'test-model',
            finishReason: 'stop',
          },
        };
      })()),
    } as unknown as jest.Mocked<AiService>;
  }

  it('lists only sessions owned by the current user in the workspace', async () => {
    const repository = createAiConversationRepository();
    const useCase = new ListAiConversationSessionsUseCase(
      createWorkspaceRepository(),
      repository,
    );

    await expect(useCase.execute(currentUser, {
      workspaceId: 'workspace-1',
      page: 2,
      limit: 10,
      q: 'summary',
    })).resolves.toEqual({
      items: [sessionSummary],
      meta: {
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      },
    });
    expect(repository.listSessions).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      page: 2,
      limit: 10,
      q: 'summary',
    });
  });


  it('lists turns only after validating current user session ownership', async () => {
    const repository = createAiConversationRepository();
    const useCase = new ListAiChatTurnsUseCase(
      createWorkspaceRepository(),
      repository,
    );

    await expect(useCase.execute(currentUser, {
      workspaceId: 'workspace-1',
      sessionId: 'ai-session-1',
      limit: 20,
      cursor: 'cursor-0',
    })).resolves.toEqual({
      items: [expect.objectContaining({
        id: 'turn-1',
        assistantResponse: 'Summary',
      })],
      meta: {
        limit: 20,
        nextCursor: 'cursor-1',
        hasMore: true,
      },
    });
    expect(repository.findSession).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      sessionId: 'ai-session-1',
      userId: 'user-1',
    });
    expect(repository.listTurns).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      sessionId: 'ai-session-1',
      userId: 'user-1',
      limit: 20,
      cursor: 'cursor-0',
    });
  });
  it('creates a private conversation session for the current user', async () => {
    const repository = createAiConversationRepository();
    const useCase = new CreateAiConversationSessionUseCase(
      createWorkspaceRepository(),
      repository,
    );

    await useCase.execute(currentUser, { workspaceId: 'workspace-1' });

    expect(repository.createSession).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });
  });

  it('reserves, generates, persists, and consumes a completed chat turn', async () => {
    const repository = createAiConversationRepository();
    const aiService = createAiService();
    const useCase = new CreateAiChatTurnUseCase(
      createWorkspaceRepository(),
      repository,
      createDocumentDetailQueryRepository(),
      new AiResponseGateService(createSubscriptionSummaryService(), repository),
      aiService,
    );

    const turn = await useCase.execute(currentUser, {
      workspaceId: 'workspace-1',
      sessionId: 'ai-session-1',
      message: 'Summarize this',
      documentIds: ['document-1'],
    });

    expect(turn.assistantResponse).toBe('Summary');
    expect(repository.consumeReservation).toHaveBeenCalledWith('reservation-1');
    expect(repository.createCompletedTurn).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'ai-session-1',
      assistantResponse: 'Summary',
      attachments: [{ documentId: 'document-1', title: 'Doc 1' }],
    }));
    expect(aiService.generateText).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ documentIds: 'document-1' }),
    }));
  });

  it('streams, persists, and consumes a completed chat turn', async () => {
    const repository = createAiConversationRepository();
    const aiService = createAiService();
    const useCase = new CreateAiChatTurnUseCase(
      createWorkspaceRepository(),
      repository,
      createDocumentDetailQueryRepository(),
      new AiResponseGateService(createSubscriptionSummaryService(), repository),
      aiService,
    );
    const events: AiChatTurnStreamEvent[] = [];

    for await (const event of useCase.executeStream(currentUser, {
      workspaceId: 'workspace-1',
      sessionId: 'ai-session-1',
      message: 'Summarize this',
      documentIds: ['document-1'],
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'started', sessionId: 'ai-session-1' },
      expect.objectContaining({
        type: 'block_start',
        blockId: 'ai-block-1',
        blockType: 'paragraph',
      }),
      {
        type: 'text_delta',
        blockId: 'ai-block-1',
        content: [{ type: 'text', text: 'Summary' }],
      },
      { type: 'block_end', blockId: 'ai-block-1' },
      expect.objectContaining({ type: 'done' }),
    ]);
    expect(repository.createCompletedTurn).toHaveBeenCalledWith(expect.objectContaining({
      assistantResponse: 'Summary',
      responseBlockPayload: [
        {
          id: 'ai-block-1',
          type: 'paragraph',
          content: [{ type: 'text', text: 'Summary' }],
        },
      ],
    }));
    expect(repository.consumeReservation).toHaveBeenCalledWith('reservation-1');
  });

  it('rejects inaccessible document attachments before provider call', async () => {
    const repository = createAiConversationRepository();
    const aiService = createAiService();
    const documentRepository = {
      findDocumentDetailsForAiSource: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<DocumentDetailQueryRepository>;
    const useCase = new CreateAiChatTurnUseCase(
      createWorkspaceRepository(),
      repository,
      documentRepository,
      new AiResponseGateService(createSubscriptionSummaryService(), repository),
      aiService,
    );

    await expect(useCase.execute(currentUser, {
      workspaceId: 'workspace-1',
      sessionId: 'ai-session-1',
      message: 'Summarize this',
      documentIds: ['document-1'],
    })).rejects.toBeInstanceOf(AiDocumentAttachmentNotFoundError);
    expect(aiService.generateText).not.toHaveBeenCalled();
  });

  it('releases a reservation when provider generation fails', async () => {
    const repository = createAiConversationRepository();
    const aiService = {
      generateText: jest.fn().mockRejectedValue(new Error('provider failed')),
    } as unknown as jest.Mocked<AiService>;
    const useCase = new CreateAiChatTurnUseCase(
      createWorkspaceRepository(),
      repository,
      createDocumentDetailQueryRepository(),
      new AiResponseGateService(createSubscriptionSummaryService(), repository),
      aiService,
    );

    await expect(useCase.execute(currentUser, {
      workspaceId: 'workspace-1',
      sessionId: 'ai-session-1',
      message: 'Summarize this',
      documentIds: ['document-1'],
    })).rejects.toThrow('AI response could not be generated');
    expect(repository.releaseReservation).toHaveBeenCalledWith('reservation-1');
  });


  it('returns AI entitlement summary after workspace access is validated', async () => {
    const repository = createAiConversationRepository();
    const useCase = new GetAiResponseEntitlementUseCase(
      createWorkspaceRepository(),
      new AiResponseGateService(createSubscriptionSummaryService(SubscriptionPlan.FREE), repository),
    );

    await expect(useCase.execute(currentUser, { workspaceId: 'workspace-1' }))
      .resolves.toEqual({
        workspaceId: 'workspace-1',
        plan: SubscriptionPlan.FREE,
        allowance: 20,
        usedResponses: 3,
        reservedResponses: 1,
        remainingResponses: 16,
        limitReached: false,
        upgradeAvailable: false,
      });
    expect(repository.getTrialResponseUsage).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      now: expect.any(Date),
    });
  });

  it('marks Free workspaces limited when all trial responses are used', async () => {
    const repository = createAiConversationRepository();
    repository.getTrialResponseUsage.mockResolvedValue({
      usedResponses: 20,
      reservedResponses: 0,
    });
    const gate = new AiResponseGateService(
      createSubscriptionSummaryService(SubscriptionPlan.FREE),
      repository,
    );

    await expect(gate.getEntitlementSummary('workspace-1')).resolves.toEqual({
      workspaceId: 'workspace-1',
      plan: SubscriptionPlan.FREE,
      allowance: 20,
      usedResponses: 20,
      reservedResponses: 0,
      remainingResponses: 0,
      limitReached: true,
      upgradeAvailable: false,
    });
  });
  it('denies Free and Plus workspaces after trial responses are exhausted', async () => {
    const repository = createAiConversationRepository();
    repository.reserveTrialResponse.mockResolvedValue(null);
    const gate = new AiResponseGateService(
      createSubscriptionSummaryService(SubscriptionPlan.FREE),
      repository,
    );

    await expect(gate.reserveResponse('workspace-1'))
      .rejects.toBeInstanceOf(AiResponseEntitlementDeniedError);
    expect(repository.reserveTrialResponse).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      allowance: 20,
    }));
  });

  it('bypasses trial reservations for Business workspaces', async () => {
    const repository = createAiConversationRepository();
    const gate = new AiResponseGateService(
      createSubscriptionSummaryService(SubscriptionPlan.BUSINESS),
      repository,
    );

    await expect(gate.reserveResponse('workspace-1')).resolves.toBeNull();
    expect(repository.reserveTrialResponse).not.toHaveBeenCalled();
  });
});
