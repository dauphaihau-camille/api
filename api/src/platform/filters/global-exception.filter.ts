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

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = buildErrorResponse(exception, statusCode, request.url);
    const requestContext = this.requestContextService.get();
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

function buildErrorResponse(
  exception: unknown,
  statusCode: number,
  path: string,
) {
  const baseResponse = {
    statusCode,
    timestamp: new Date().toISOString(),
    path,
  };

  if (!(exception instanceof HttpException)) {
    return {
      ...baseResponse,
      error: 'Internal Server Error',
      message: 'Internal server error',
    };
  }

  const exceptionResponse = exception.getResponse();

  if (typeof exceptionResponse === 'string') {
    return {
      ...baseResponse,
      error: exception.name,
      message: exceptionResponse,
    };
  }

  if (
    exceptionResponse
    && typeof exceptionResponse === 'object'
    && !Array.isArray(exceptionResponse)
  ) {
    const responsePayload = exceptionResponse as Record<string, unknown>;

    return {
      ...baseResponse,
      error:
        typeof responsePayload.error === 'string'
          ? responsePayload.error
          : exception.name,
      message:
        typeof responsePayload.message === 'string'
        || Array.isArray(responsePayload.message)
          ? responsePayload.message
          : exception.message,
    };
  }

  return {
    ...baseResponse,
    error: exception.name,
    message: exception.message,
  };
}
