import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { buildPinoLoggerParams } from '~/common/logging/pino-logger.config';
import { QueueModule } from './queue.module';
import { BullMqWorkerService } from './infra/bullmq-worker.service';

@Module({
  imports: [
    LoggerModule.forRoot(buildPinoLoggerParams('worker')),
    QueueModule,
  ],
  providers: [BullMqWorkerService],
})
export class QueueWorkerModule {}
