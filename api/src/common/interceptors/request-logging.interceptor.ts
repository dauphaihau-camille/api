import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestContextService } from '~/modules/shared/request-context/request-context.service';
import { ObservabilityService } from '~/modules/shared/observability/observability.service';
import { getActiveTraceContext } from '~/modules/shared/observability/tracing';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly requestContextService: RequestContextService,
    private readonly observabilityService: ObservabilityService,
    private readonly logger: PinoLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request | undefined>();
    const response = http.getResponse<Response | undefined>();
    const startedAt = Date.now();

    if (!request || !response) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;

          this.observabilityService.recordHttpRequest(
            request.method,
            this.resolveRoute(request),
            response.statusCode,
            durationMs,
          );
          this.logger.info(
            this.buildHttpLogPayload(
              'http.request.completed',
              request,
              response.statusCode,
              durationMs,
            ),
            this.buildHttpSummary(
              request.method,
              this.resolveRoute(request),
              response.statusCode,
              durationMs,
            ),
          );
        },
        error: (error: unknown) => {
          const durationMs = Date.now() - startedAt;
          const statusCode = this.resolveFailureStatusCode(error);
          const logMethod = statusCode >= 500 ? 'error' : 'warn';

          this.observabilityService.recordHttpRequest(
            request.method,
            this.resolveRoute(request),
            statusCode,
            durationMs,
          );
          this.logger[logMethod](
            this.buildHttpLogPayload(
              'http.request.failed',
              request,
              statusCode,
              durationMs,
            ),
            this.buildHttpSummary(
              request.method,
              this.resolveRoute(request),
              statusCode,
              durationMs,
            ),
          );
        },
      }),
    );
  }

  private resolveRoute(request: Request): string {
    const routePath = typeof request.route?.path === 'string'
      ? request.route.path
      : request.route?.path instanceof RegExp
        ? request.route.path.toString()
        : undefined;

    if (routePath) {
      const baseUrl = request.baseUrl?.trim();

      return `${baseUrl ?? ''}${routePath}` || request.path;
    }

    return request.path;
  }

  private buildHttpSummary(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): string {
    return `${method.toUpperCase()} ${route} ${statusCode} ${durationMs}ms`;
  }

  private resolveFailureStatusCode(error: unknown): number {
    if (error instanceof HttpException) {
      return error.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private buildHttpLogPayload(
    event: 'http.request.completed' | 'http.request.failed',
    request: Request,
    statusCode: number,
    durationMs: number,
  ) {
    const requestContext = this.requestContextService.get();
    const traceContext = getActiveTraceContext();

    if (requestContext.requestId) {
      request.res?.setHeader('X-Request-Id', requestContext.requestId);
    }

    return {
      actorEmail: requestContext.actorEmail,
      actorId: requestContext.actorId,
      context: RequestLoggingInterceptor.name,
      event,
      http: {
        durationMs,
        method: request.method,
        path: request.url,
        route: this.resolveRoute(request),
        statusCode,
      },
      ipAddress: requestContext.ipAddress,
      requestId: requestContext.requestId,
      sessionId: requestContext.sessionId,
      spanId: traceContext?.spanId,
      traceId: traceContext?.traceId,
      userAgent: requestContext.userAgent,
    };
  }
}
