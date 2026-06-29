import {
  Controller,
  Header,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../domains/auth/api/guard/jwt-auth.guard';
import type { AuthenticatedUser } from '../../domains/auth/app/auth.types';
import { SseService } from './sse.service';

@Controller('events')
@UseGuards(JwtAuthGuard)
@ApiTags('Events')
@ApiCookieAuth('access_token')
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Sse('stream')
  @Header('Cache-Control', 'no-store')
  @Header('X-Accel-Buffering', 'no')
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary: 'Stream',
  })
  @ApiOkResponse({
    description: 'Server-Sent Events stream for the authenticated user.',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example: [
            'event: connected',
            'data: {"userId":"user_123","sessionId":"session_123"}',
            '',
            'event: heartbeat',
            'data: {"timestamp":"2026-06-28T06:00:00.000Z"}',
            '',
          ].join('\n'),
        },
      },
    },
  })
  stream(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Observable<MessageEvent> {
    return this.sseService.createUserStream(currentUser);
  }
}
