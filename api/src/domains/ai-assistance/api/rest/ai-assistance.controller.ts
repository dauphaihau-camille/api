import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { JwtAuthGuard } from '~/domains/auth/api/guard/jwt-auth.guard';
import { PermissionsGuard } from '~/domains/auth/api/guard/permissions.guard';
import { CurrentUser } from '~/platform/decorators/current-user.decorator';
import {
  CreateAiChatTurnUseCase,
  type AiChatTurnStreamEvent,
} from '../../app/use-cases/create-ai-chat-turn.use-case';
import { GetAiResponseEntitlementUseCase } from '../../app/use-cases/get-ai-response-entitlement.use-case';
import { ListAiChatTurnsUseCase } from '../../app/use-cases/list-ai-chat-turns.use-case';
import {
  CreateAiConversationSessionUseCase,
  ListAiConversationSessionsUseCase,
} from '../../app/use-cases/session.use-cases';
import { rethrowAiAssistanceAppError } from './ai-assistance-http-error-mapper';
import {
  AiChatTurnResponseDto,
  AiConversationSessionResponseDto,
  AiResponseEntitlementResponseDto,
  CreateAiChatTurnDto,
  CursorPaginatedAiChatTurnResponseDto,
  PaginatedAiConversationSessionResponseDto,
} from './dto/ai-assistance.dto';
import { ListAiConversationSessionsQueryDto } from './dto/list-ai-conversation-sessions.query.dto';
import { ListAiChatTurnsQueryDto } from './dto/list-ai-chat-turns.query.dto';

@Controller('workspaces/:workspaceId/ai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('AI Assistance')
export class AiAssistanceController {
  constructor(
    private readonly listSessionsUseCase: ListAiConversationSessionsUseCase,
    private readonly createSessionUseCase: CreateAiConversationSessionUseCase,
    private readonly listTurnsUseCase: ListAiChatTurnsUseCase,
    private readonly createChatTurnUseCase: CreateAiChatTurnUseCase,
    private readonly getAiResponseEntitlementUseCase: GetAiResponseEntitlementUseCase,
  ) {}

  @Get('entitlement')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get AI response entitlement status' })
  @ApiOkResponse({ type: AiResponseEntitlementResponseDto })
  async getEntitlement(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<AiResponseEntitlementResponseDto> {
    return this.getAiResponseEntitlementUseCase
      .execute(currentUser, { workspaceId })
      .then(AiResponseEntitlementResponseDto.fromSummary)
      .catch(rethrowAiAssistanceAppError);
  }

  @Get('conversations')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List AI conversation sessions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiOkResponse({ type: PaginatedAiConversationSessionResponseDto })
  async listSessions(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListAiConversationSessionsQueryDto,
  ): Promise<PaginatedAiConversationSessionResponseDto> {
    return this.listSessionsUseCase
      .execute(currentUser, {
        workspaceId,
        page: query.page,
        limit: query.limit,
        q: query.q, 
      })
      .then(PaginatedAiConversationSessionResponseDto.fromPaginatedResult)
      .catch(rethrowAiAssistanceAppError);
  }

  @Post('conversations')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Create AI conversation session' })
  @ApiCreatedResponse({ type: AiConversationSessionResponseDto })
  async createSession(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<AiConversationSessionResponseDto> {
    return this.createSessionUseCase
      .execute(currentUser, { workspaceId })
      .then(AiConversationSessionResponseDto.fromSummary)
      .catch(rethrowAiAssistanceAppError);
  }

  @Get('conversations/:sessionId/turns')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List AI chat turns' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiOkResponse({ type: CursorPaginatedAiChatTurnResponseDto })
  async listTurns(
    @Param('workspaceId') workspaceId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListAiChatTurnsQueryDto,
  ): Promise<CursorPaginatedAiChatTurnResponseDto> {
    return this.listTurnsUseCase
      .execute(currentUser, {
        workspaceId,
        sessionId,
        limit: query.limit,
        cursor: query.cursor,
      })
      .then(CursorPaginatedAiChatTurnResponseDto.fromCursorPaginatedResult)
      .catch(rethrowAiAssistanceAppError);
  }

  @Post('conversations/:sessionId/turns')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Create AI chat turn' })
  @ApiOkResponse({ type: AiChatTurnResponseDto })
  async createTurn(
    @Param('workspaceId') workspaceId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreateAiChatTurnDto,
  ): Promise<AiChatTurnResponseDto> {
    return this.createChatTurnUseCase
      .execute(currentUser, {
        workspaceId,
        sessionId,
        message: body.message,
        documentIds: body.document_ids ?? [],
      })
      .then(AiChatTurnResponseDto.fromSummary)
      .catch(rethrowAiAssistanceAppError);
  }

  @Post('conversations/:sessionId/turns/stream')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Stream AI chat turn' })
  async streamTurn(
    @Param('workspaceId') workspaceId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() body: CreateAiChatTurnDto,
    @Res() response: Response,
  ): Promise<void> {
    const stream = this.createChatTurnUseCase.executeStream(currentUser, {
      workspaceId,
      sessionId,
      message: body.message,
      documentIds: body.document_ids ?? [],
    })[Symbol.asyncIterator]();

    let headersSent = false;

    try {
      let nextEvent = await stream.next();

      if (nextEvent.done) {
        response.end();
        return;
      }

      response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store, no-transform');
      response.setHeader('X-Accel-Buffering', 'no');
      response.flushHeaders?.();
      headersSent = true;

      while (!nextEvent.done) {
        this.writeNdjson(response, this.toStreamResponseEvent(nextEvent.value));
        nextEvent = await stream.next();
      }
      response.end();
    }
    catch (error) {
      if (!headersSent) {
        rethrowAiAssistanceAppError(error);
      }

      this.writeNdjson(response, {
        type: 'error',
        message: error instanceof Error
          ? error.message
          : 'AI response could not be generated',
      });
      response.end();
    }
  }

  private toStreamResponseEvent(event: AiChatTurnStreamEvent): Record<string, unknown> {
    if (event.type === 'done') {
      return {
        type: 'done',
        turn: AiChatTurnResponseDto.fromSummary(event.turn),
      };
    }

    if (event.type === 'started') {
      return {
        type: 'started',
        session_id: event.sessionId,
      };
    }

    if (event.type === 'block_start') {
      return {
        type: 'block_start',
        block_id: event.blockId,
        block_type: event.blockType,
        ...(event.props ? { props: event.props } : {}),
      };
    }

    if (event.type === 'text_delta') {
      return {
        type: 'text_delta',
        block_id: event.blockId,
        content: event.content,
      };
    }

    if (event.type === 'block_end') {
      return {
        type: 'block_end',
        block_id: event.blockId,
      };
    }

    return event;
  }

  private writeNdjson(response: Response, event: Record<string, unknown>): void {
    response.write(`${JSON.stringify(event)}\n`);
  }
}
