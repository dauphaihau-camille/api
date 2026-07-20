import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  APP_JOB_RUNNER,
  type AppJobRunner,
} from './app/app-job-runner';
import {
  QueueConfig,
  QUEUE_CONFIG,
  buildQueueConfig,
} from '~/platform/config/queue.config';
import { MailModule } from '../mail/mail.module';
import { ObservabilityModule } from '../../platform/observability/observability.module';
import { ObservabilityService } from '../../platform/observability/observability.service';
import Redis from 'ioredis';
import { JobDispatcher } from './app/ports/job-dispatcher';
import { BullMqConnectionManager } from './infra/bullmq-connection-manager';
import { BullMqJobDispatcher } from './infra/bullmq-job-dispatcher';
import { InlineJobDispatcher } from './infra/inline-job-dispatcher';
import { BULLMQ_CONNECTION, BULLMQ_QUEUE } from './infra/queue.constants';

@Module({
  imports: [
    ConfigModule,
    MailModule,
    ObservabilityModule,
  ],
  providers: [
    {
      provide: QUEUE_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildQueueConfig(configService),
    },
    {
      provide: BULLMQ_CONNECTION,
      inject: [QUEUE_CONFIG, ObservabilityService],
      useFactory: (
        queueConfig: QueueConfig,
        observabilityService: ObservabilityService,
      ) => {
        if (queueConfig.driver !== 'redis') {
          return null;
        }

        const connection = new Redis(queueConfig.redisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        });

        connection.on('error', () => {
          observabilityService.recordRedisConnectionError('bullmq');
        });

        return connection;
      },
    },
    {
      provide: BULLMQ_QUEUE,
      inject: [QUEUE_CONFIG, BULLMQ_CONNECTION, ObservabilityService],
      useFactory: (
        queueConfig: QueueConfig,
        connection: Redis | null,
        observabilityService: ObservabilityService,
      ) => {
        if (queueConfig.driver !== 'redis' || !connection) {
          observabilityService.attachBullMqQueue(null);
          return null;
        }

        const queue = new Queue(queueConfig.queueName, {
          connection,
          prefix: queueConfig.prefix,
        });

        observabilityService.attachBullMqQueue(queue);

        return queue;
      },
    },
    BullMqConnectionManager,
    {
      provide: JobDispatcher,
      inject: [QUEUE_CONFIG, BULLMQ_CONNECTION, APP_JOB_RUNNER],
      useFactory: (
        queueConfig: QueueConfig,
        connection: Redis | null,
        appJobRunner: AppJobRunner,
      ) => {
        if (queueConfig.driver === 'redis') {
          if (!connection) {
            throw new Error(
              'Missing BullMQ Redis connection for redis queue driver',
            );
          }

          return new BullMqJobDispatcher(queueConfig, connection);
        }

        return new InlineJobDispatcher(appJobRunner);
      },
    },
  ],
  exports: [QUEUE_CONFIG, BULLMQ_CONNECTION, BULLMQ_QUEUE, JobDispatcher],
})
export class QueueModule {}
