import {
  ClassSerializerInterceptor,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import type { Queue } from 'bullmq';
import express from 'express';
import { Logger, PinoLogger } from 'nestjs-pino';
import { setupApiDocs } from '../platform/docs/setup-api-docs';
import { setupBullBoard } from '../platform/docs/setup-bull-board';
import { GlobalExceptionFilter } from '../platform/filters/global-exception.filter';
import { RequestLoggingInterceptor } from '../platform/interceptors/request-logging.interceptor';
import {
  APP_RUNTIME_CONFIG,
  type AppRuntimeConfig,
} from '../platform/config/app-runtime.config';
import { AppModule } from './app.module';
import { ObservabilityService } from '../platform/observability/observability.service';
import { BULLMQ_QUEUE } from '../integrations/queue/infra/queue.constants';
import { RequestContextService } from '../platform/request-context/request-context.service';

const API_PREFIX = 'v1';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const bootstrapLogger = await app.resolve(PinoLogger);
  const requestLogger = await app.resolve(PinoLogger);
  const exceptionLogger = await app.resolve(PinoLogger);
  const appRuntimeConfig = app.get<AppRuntimeConfig>(APP_RUNTIME_CONFIG);

  if (appRuntimeConfig.trustProxy) {
    app.getHttpAdapter().getInstance().set('trust proxy', true);
  }

  if (appRuntimeConfig.corsAllowedOrigins.length > 0) {
    app.enableCors({
      origin: appRuntimeConfig.corsAllowedOrigins,
      credentials: true,
    });
  }

  app.enableShutdownHooks();
  app.use(express.json({
    limit: appRuntimeConfig.requestBodyLimit,
    verify: (req, _res, buffer) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    },
  }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(
    new GlobalExceptionFilter(
      app.get(RequestContextService),
      exceptionLogger,
    ),
  );
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new RequestLoggingInterceptor(
      app.get(RequestContextService),
      app.get(ObservabilityService),
      requestLogger,
    ),
  );
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [
      {
        path: 'health',
        method: RequestMethod.GET,
      },
      {
        path: 'health/ready',
        method: RequestMethod.GET,
      },
      {
        path: 'metrics',
        method: RequestMethod.GET,
      },
    ],
  });
  setupApiDocs(app);
  setupBullBoard(
    app,
    app.get<Queue | null>(BULLMQ_QUEUE, { strict: false }),
  );

  bootstrapLogger.info({
    context: 'Bootstrap',
    event: 'bootstrap.http.listen.start',
    port: appRuntimeConfig.port,
  }, 'Starting HTTP listener');

  await app.listen(appRuntimeConfig.port);

  bootstrapLogger.info({
    context: 'Bootstrap',
    event: 'bootstrap.http.listen.ready',
    port: appRuntimeConfig.port,
  }, 'HTTP listener ready');
}

void bootstrap();
