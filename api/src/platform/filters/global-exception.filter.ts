import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { RequestContextService } from '~/platform/request-context/request-context.service';
import { getActiveTraceContext } from '~/platform/observability/tracing';
import { resolveErrorCode } from '~/platform/http/api-error-code';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly requestContextService: RequestContextService,
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response | undefined>();
    const request = context.getRequest<Request | undefined>();

    if (!response || !request) {
      throw exception;
    }

    const statusCode = resolveStatusCode(exception);
    const requestContext = this.requestContextService.get();

    const responseBody = buildErrorResponse(
      exception,
      statusCode,
      requestContext.requestId,
    );
    const traceContext = getActiveTraceContext();

    if (requestContext.requestId && !response.headersSent) {
      response.setHeader('X-Request-Id', requestContext.requestId);
    }

    if (statusCode >= 500) {
      const errorMessage = exception instanceof Error
        ? exception.message
        : 'Unknown error';

      this.logger.error(
        {
          actorEmail: requestContext.actorEmail,
          actorId: requestContext.actorId,
          context: GlobalExceptionFilter.name,
          errorMessage,
          errorName: exception instanceof Error ? exception.name : 'UnknownError',
          http: {
            method: request.method,
            path: request.url,
            statusCode,
          },
          ipAddress: requestContext.ipAddress,
          requestId: requestContext.requestId,
          sessionId: requestContext.sessionId,
          spanId: traceContext?.spanId,
          traceId: traceContext?.traceId,
          userAgent: requestContext.userAgent,
        },
        errorMessage,
      );
    }

    if (response.headersSent || response.writableEnded) {
      if (!response.writableEnded) {
        response.end();
      }

      return;
    }

    response.status(statusCode).json(responseBody);
  }
}

export function resolveStatusCode(exception: unknown) {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  if (!exception || typeof exception !== 'object') {
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  const candidate = exception as {
    status?: unknown;
    statusCode?: unknown;
  };
  const statusCode = typeof candidate.statusCode === 'number'
    ? candidate.statusCode
    : candidate.status;

  return typeof statusCode === 'number'
    && statusCode >= 400
    && statusCode < 600
    ? statusCode
    : HttpStatus.INTERNAL_SERVER_ERROR;
}

/**
 * Public error envelope. Exactly these keys are emitted, always snake_case.
 */
export interface PublicErrorResponse {
  status_code: number;
  code: string;
  message: string;
  request_id?: string;
  details?: Record<string, unknown>;
}

/**
 * Payload keys the envelope owns; a mapper payload can never override them.
 * Legacy `timestamp`/`path` keys are discarded rather than promoted.
 */
const RESERVED_PAYLOAD_KEYS: Readonly<Record<string, true>> = {
  code: true,
  message: true,
  error: true,
  details: true,
  status_code: true,
  statusCode: true,
  request_id: true,
  timestamp: true,
  path: true,
};

export function buildErrorResponse(
  exception: unknown,
  statusCode: number,
  requestId?: string,
): PublicErrorResponse {
  const body: PublicErrorResponse = {
    status_code: statusCode,
    code: resolveErrorCode(statusCode),
    message: 'Internal server error',
  };

  if (requestId) {
    body.request_id = requestId;
  }

  if (!(exception instanceof HttpException)) {
    return body;
  }

  const exceptionResponse = exception.getResponse();

  if (typeof exceptionResponse === 'string') {
    body.message = normalizeMessage(exceptionResponse) ?? exception.message;

    return body;
  }

  if (Array.isArray(exceptionResponse)) {
    body.message = normalizeMessage(exceptionResponse) ?? exception.message;

    return body;
  }

  if (exceptionResponse && typeof exceptionResponse === 'object') {
    const responsePayload = exceptionResponse as Record<string, unknown>;
    body.code = resolveErrorCode(statusCode, responsePayload.code);
    body.message =
      normalizeMessage(responsePayload.message) ??
      normalizeMessage(exception.message) ??
      body.message;

    const payloadDetails = isPlainObject(responsePayload.details)
      ? responsePayload.details
      : {};
    const extras = Object.fromEntries(
      Object.entries(responsePayload)
        .filter(([key]) => RESERVED_PAYLOAD_KEYS[key] !== true),
    );
    const details = { ...payloadDetails, ...extras };

    if (Object.keys(details).length > 0) {
      body.details = details;
    }

    return body;
  }

  body.message = normalizeMessage(exception.message) ?? body.message;

  return body;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeMessage(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.length > 0 ? value : undefined;
  }

  if (Array.isArray(value)) {
    const parts = value.filter(
      (part): part is string => typeof part === 'string' && part.length > 0,
    );

    return parts.length > 0 ? parts.join('; ') : undefined;
  }

  return undefined;
}
