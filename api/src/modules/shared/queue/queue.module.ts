import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CurrentUserEntity } from '../../domains/auth/infra/persistence/entities/current-user.entity';
import { SendNotificationEmailJob } from '../../../common/jobs/send-notification-email.job';
import { PermanentlyDeleteArchivedDocumentJob } from '../../../common/jobs/permanently-delete-archived-document.job';
import {
  QueueConfig,
  QUEUE_CONFIG,
  buildQueueConfig,
} from '../../../config/queue.config';
import { MailModule } from '../mail/mail.module';
import { ObservabilityModule } from '../observability/observability.module';
import { ObservabilityService } from '../observability/observability.service';
import Redis from 'ioredis';
import { SendWelcomeEmailJob } from '../../../common/jobs/send-welcome-email.job';
import { DocumentEntity } from '../../domains/document/infra/persistence/entities/document.entity';
import { JobDispatcher } from './app/ports/job-dispatcher';
import { AppJobRunner } from './infra/app-job-runner';
import { BullMqConnectionManager } from './infra/bullmq-connection-manager';
import { BullMqJobDispatcher } from './infra/bullmq-job-dispatcher';
import { InlineJobDispatcher } from './infra/inline-job-dispatcher';
import { BULLMQ_CONNECTION, BULLMQ_QUEUE } from './infra/queue.constants';

@Module({
  imports: [
    ConfigModule,
    MailModule,
    ObservabilityModule,
    MikroOrmModule.forFeature([CurrentUserEntity, DocumentEntity]),
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
    AppJobRunner,
    PermanentlyDeleteArchivedDocumentJob,
    SendNotificationEmailJob,
    SendWelcomeEmailJob,
    {
      provide: JobDispatcher,
      inject: [QUEUE_CONFIG, BULLMQ_CONNECTION, AppJobRunner],
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
  exports: [QUEUE_CONFIG, BULLMQ_CONNECTION, BULLMQ_QUEUE, JobDispatcher, AppJobRunner],
})
export class QueueModule {}
