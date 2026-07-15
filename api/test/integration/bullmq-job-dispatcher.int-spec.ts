import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { appJobName } from '~/common/jobs/job.types';
import type { QueueConfig } from '~/config/queue.config';
import { BullMqJobDispatcher } from '~/modules/shared/queue/infra/bullmq-job-dispatcher';

describe('BullMqJobDispatcher integration', () => {
  let connection: IORedis | undefined;
  let inspector: Queue | undefined;
  let dispatcher: BullMqJobDispatcher | undefined;
  let skipReason: string | undefined;
  let redisUrl: string | undefined;

  beforeAll(async () => {
    redisUrl = process.env.BULLMQ_INT_TEST_REDIS_URL ?? process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error(
        'Missing BullMQ integration env: BULLMQ_INT_TEST_REDIS_URL or REDIS_URL',
      );
    }

    connection = new IORedis(redisUrl, {
      connectTimeout: 1_000,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: () => null,
    });
    connection.on('error', () => undefined);

    try {
      await connection.connect();
      await connection.ping();
    }
    catch (error) {
      skipReason = `Skipping BullMqJobDispatcher integration: Redis is not reachable at ${redisUrl}. ${String(error)}`;
      connection.disconnect();
      connection = undefined;
      throw new Error(skipReason);
    }
  }, 10_000);

  afterAll(async () => {
    if (inspector) {
      await inspector.close();
    }

    if (dispatcher) {
      await dispatcher.onApplicationShutdown();
    }

    connection?.disconnect();
  });

  it('enqueues jobs with normalized deduplication keys and delay options', async () => {
    if (!connection) {
      throw new Error(skipReason ?? 'BullMQ Redis connection was not initialized.');
    }

    const runId = randomUUID().replaceAll('-', '');
    const queueConfig: QueueConfig = {
      driver: 'redis',
      queueName: `int-queue-${runId}`,
      prefix: `int-prefix-${runId}`,
      redisUrl: redisUrl!,
      defaultAttempts: 3,
      defaultBackoffMilliseconds: 250,
      removeCompletedAfterSeconds: 60,
      removeFailedAfterSeconds: 60,
      workerConcurrency: 1,
    };

    inspector = new Queue(queueConfig.queueName, {
      connection,
      prefix: queueConfig.prefix,
    });
    dispatcher = new BullMqJobDispatcher(queueConfig, connection);

    try {
      await inspector.obliterate({ force: true });

      await dispatcher.dispatch(
        appJobName.notificationSendEmail,
        {
          to: [{ email: 'integration@example.com' }],
          subject: 'Integration notification',
          text: 'Hello from BullMQ integration',
        },
        {
          deduplicationKey: 'notification:integration:email',
          delayMs: 5_000,
        },
      );

      const job = await inspector.getJob('notification__integration__email');

      expect(job).not.toBeNull();
      expect(job?.name).toBe(appJobName.notificationSendEmail);
      expect(job?.delay).toBe(5_000);
      expect(job?.opts.attempts).toBe(queueConfig.defaultAttempts);
      expect(job?.opts.backoff).toMatchObject({
        type: 'exponential',
        delay: queueConfig.defaultBackoffMilliseconds,
      });
      expect(job?.data).toMatchObject({
        to: [{ email: 'integration@example.com' }],
        subject: 'Integration notification',
      });
    }
    finally {
      await inspector.obliterate({ force: true }).catch(() => undefined);
    }
  }, 20_000);
});
