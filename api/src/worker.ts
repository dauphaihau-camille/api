import { NestFactory } from '@nestjs/core';
import { Logger, PinoLogger } from 'nestjs-pino';
import { QueueWorkerModule } from './modules/shared/queue/queue-worker.module';
import { validateAppEnv } from './config/app-env.config';

async function bootstrap() {
  validateAppEnv(process.env);
  const app = await NestFactory.createApplicationContext(QueueWorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  const bootstrapLogger = await app.resolve(PinoLogger);

  app.enableShutdownHooks();

  bootstrapLogger.info({
    context: 'Bootstrap',
    event: 'bootstrap.worker.ready',
  }, 'Worker application context ready');
}

void bootstrap();
