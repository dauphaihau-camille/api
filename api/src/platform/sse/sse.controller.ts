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
import { CurrentUser } from '~/platform/decorators/current-user.decorator';
import { tooManyRequestsErrorExample } from '~/platform/http/api-error-examples';
import {
  ApiErrorResponses,
  type ApiErrorExample,
} from '~/platform/http/api-error-responses.decorator';
import { JwtAuthGuard } from '../../domains/auth/api/guard/jwt-auth.guard';
import type { AuthenticatedUser } from '../../domains/auth/app/auth.types';
import { SseService } from './sse.service';

/**
 * SSE is a platform route; it cannot depend on the auth domain for the example
 * payload. The 401 the `JwtAuthGuard` produces is kept identical to the
 * auth-owned example, so the contract does not change.
 */
const sseUnauthorizedErrorExample: ApiErrorExample = {
  code: 'UNAUTHORIZED',
  message: 'Unauthorized',
};

@Controller('events')
@UseGuards(JwtAuthGuard)
@ApiErrorResponses({
  401: [sseUnauthorizedErrorExample],
  429: [tooManyRequestsErrorExample],
})
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
