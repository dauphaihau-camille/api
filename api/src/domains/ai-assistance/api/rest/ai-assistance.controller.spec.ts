import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import { AiResponseEntitlementDeniedError } from '../../app/errors/ai-assistance-app.error';
import { mapAiAssistanceAppErrorToHttpException } from './ai-assistance-http-error-mapper';
import { AiAssistanceController } from './ai-assistance.controller';

describe('AiAssistanceController', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  const session = {
    id: 'ai-session-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    title: 'Summarize this',
    group: 'Past week' as const,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:01:00.000Z'),
  };

  const unusedUseCase = { execute: jest.fn() } as never;

  it('returns conversation sessions with the external snake_case contract', async () => {
    const controller = new AiAssistanceController(
      {
        execute: jest.fn().mockResolvedValue({
          items: [session],
          meta: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        }), 
      } as never,
      unusedUseCase,
      unusedUseCase,
      unusedUseCase,
      unusedUseCase,
    );

    await expect(controller.listSessions('workspace-1', currentUser, {
      page: 1,
      limit: 20,
      q: 'summary',
    })).resolves.toEqual({
      items: [
        {
          id: 'ai-session-1',
          workspace_id: 'workspace-1',
          title: 'Summarize this',
          group: 'Past week',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:01:00.000Z',
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
        has_next_page: false,
        has_previous_page: false,
      },
    });
  });

  it('returns AI entitlement with the external snake_case contract', async () => {
    const getEntitlement = jest.fn().mockResolvedValue({
      workspaceId: 'workspace-1',
      plan: 'free',
      allowance: 20,
      usedResponses: 20,
      reservedResponses: 0,
      remainingResponses: 0,
      limitReached: true,
      upgradeAvailable: false,
    });
    const controller = new AiAssistanceController(
      unusedUseCase,
      unusedUseCase,
      unusedUseCase,
      unusedUseCase,
      { execute: getEntitlement } as never,
    );

    await expect(controller.getEntitlement('workspace-1', currentUser))
      .resolves.toEqual({
        workspace_id: 'workspace-1',
        plan: 'free',
        allowance: 20,
        used_responses: 20,
        reserved_responses: 0,
        remaining_responses: 0,
        limit_reached: true,
        upgrade_available: false,
      });
    expect(getEntitlement).toHaveBeenCalledWith(currentUser, {
      workspaceId: 'workspace-1',
    });
  });

  it('maps AI response limit errors to coded 403 payloads', () => {
    const exception = mapAiAssistanceAppErrorToHttpException(
      new AiResponseEntitlementDeniedError(0, false),
    );

    expect(exception.getStatus()).toBe(403);
    expect(exception.getResponse()).toEqual({
      code: 'ai_response_limit_reached',
      message: 'Workspace AI trial responses are exhausted',
      remaining_responses: 0,
      upgrade_available: false,
    });
  });

  it('maps turn requests from snake_case body fields to app input', async () => {
    const createTurn = jest.fn().mockResolvedValue({
      id: 'turn-1',
      sessionId: 'ai-session-1',
      userMessage: 'Summarize this',
      assistantResponse: 'Summary',
      status: 'completed',
      attachments: [{ documentId: 'document-1', title: 'Doc 1' }],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:01:00.000Z'),
    });
    const controller = new AiAssistanceController(
      unusedUseCase,
      unusedUseCase,
      unusedUseCase,
      { execute: createTurn } as never,
      unusedUseCase,
    );

    await expect(controller.createTurn(
      'workspace-1',
      'ai-session-1',
      currentUser,
      { message: 'Summarize this', document_ids: ['document-1'] },
    )).resolves.toEqual({
      id: 'turn-1',
      session_id: 'ai-session-1',
      user_message: 'Summarize this',
      assistant_response: 'Summary',
      status: 'completed',
      attachments: [{ document_id: 'document-1', title: 'Doc 1' }],
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:01:00.000Z',
    });
    expect(createTurn).toHaveBeenCalledWith(currentUser, {
      workspaceId: 'workspace-1',
      sessionId: 'ai-session-1',
      message: 'Summarize this',
      documentIds: ['document-1'],
    });
  });

  it('returns conversation turns with the external snake_case contract', async () => {
    const listTurns = jest.fn().mockResolvedValue({
      items: [{
        id: 'turn-1',
        sessionId: 'ai-session-1',
        userMessage: 'Summarize this',
        assistantResponse: 'Summary',
        status: 'completed',
        attachments: [{ documentId: 'document-1', title: 'Doc 1' }],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:01:00.000Z'),
      }],
      meta: {
        limit: 50,
        nextCursor: 'cursor-1',
        hasMore: true,
      },
    });
    const controller = new AiAssistanceController(
      unusedUseCase,
      unusedUseCase,
      { execute: listTurns } as never,
      unusedUseCase,
      unusedUseCase,
    );

    await expect(controller.listTurns(
      'workspace-1',
      'ai-session-1',
      currentUser,
      { limit: 50, cursor: 'cursor-0' },
    )).resolves.toEqual({
      items: [{
        id: 'turn-1',
        session_id: 'ai-session-1',
        user_message: 'Summarize this',
        assistant_response: 'Summary',
        status: 'completed',
        attachments: [{ document_id: 'document-1', title: 'Doc 1' }],
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:01:00.000Z',
      }],
      meta: {
        limit: 50,
        next_cursor: 'cursor-1',
        has_more: true,
      },
    });
    expect(listTurns).toHaveBeenCalledWith(currentUser, {
      workspaceId: 'workspace-1',
      sessionId: 'ai-session-1',
      limit: 50,
      cursor: 'cursor-0',
    });
  });

  it('streams turn events as newline-delimited JSON', async () => {
    const createTurn = {
      executeStream: jest.fn().mockReturnValue((async function* streamTurn() {
        yield { type: 'started', sessionId: 'ai-session-1' };
        yield { type: 'delta', text: 'Sum' };
        yield {
          type: 'done',
          turn: {
            id: 'turn-1',
            sessionId: 'ai-session-1',
            userMessage: 'Summarize this',
            assistantResponse: 'Summary',
            status: 'completed',
            attachments: [{ documentId: 'document-1', title: 'Doc 1' }],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:01:00.000Z'),
          },
        };
      })()),
    };
    const response = {
      end: jest.fn(),
      flushHeaders: jest.fn(),
      setHeader: jest.fn(),
      write: jest.fn(),
    };
    const controller = new AiAssistanceController(
      unusedUseCase,
      unusedUseCase,
      unusedUseCase,
      createTurn as never,
      unusedUseCase,
    );

    await controller.streamTurn(
      'workspace-1',
      'ai-session-1',
      currentUser,
      { message: 'Summarize this', document_ids: ['document-1'] },
      response as never,
    );

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/x-ndjson; charset=utf-8');
    expect(response.write).toHaveBeenCalledWith(JSON.stringify({
      type: 'started',
      session_id: 'ai-session-1',
    }) + '\n');
    expect(response.write).toHaveBeenCalledWith(JSON.stringify({
      type: 'delta',
      text: 'Sum',
    }) + '\n');
    expect(response.write).toHaveBeenCalledWith(JSON.stringify({
      type: 'done',
      turn: {
        id: 'turn-1',
        session_id: 'ai-session-1',
        user_message: 'Summarize this',
        assistant_response: 'Summary',
        status: 'completed',
        attachments: [{ document_id: 'document-1', title: 'Doc 1' }],
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:01:00.000Z',
      },
    }) + '\n');
    expect(response.end).toHaveBeenCalledTimes(1);
    expect(createTurn.executeStream).toHaveBeenCalledWith(currentUser, {
      workspaceId: 'workspace-1',
      sessionId: 'ai-session-1',
      message: 'Summarize this',
      documentIds: ['document-1'],
    });
  });
});
