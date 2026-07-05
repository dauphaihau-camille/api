import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateAppEnv } from '~/config/app-env.config';
import { buildPinoLoggerParams } from '~/common/logging/pino-logger.config';
import { QueueModule } from './queue.module';
import { BullMqWorkerService } from './infra/bullmq-worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateAppEnv,
    }),
    LoggerModule.forRoot(buildPinoLoggerParams('worker')),
    QueueModule,
  ],
  providers: [BullMqWorkerService],
})
export class QueueWorkerModule {}
