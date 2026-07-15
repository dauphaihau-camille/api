import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { RedisRateLimitStorage } from '~/integrations/rate-limit/infra/redis-rate-limit.storage';

type RedisIntegrationClient = ReturnType<typeof createClient>;

describe('RedisRateLimitStorage integration', () => {
  let client: RedisIntegrationClient | undefined;
  let skipReason: string | undefined;
  let redisUrl: string | undefined;

  beforeAll(async () => {
    redisUrl = process.env.REDIS_RATE_LIMIT_INT_TEST_URL ?? process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error(
        'Missing Redis integration env: REDIS_RATE_LIMIT_INT_TEST_URL or REDIS_URL',
      );
    }

    client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 1_000,
        reconnectStrategy: false,
      },
    });
    client.on('error', () => undefined);

    try {
      await client.connect();
      await client.ping();
    }
    catch (error) {
      skipReason = `Skipping RedisRateLimitStorage integration: Redis is not reachable at ${redisUrl}. ${String(error)}`;
      if (client.isOpen) {
        await client.quit().catch(() => undefined);
      }
      client = undefined;
      throw new Error(skipReason);
    }
  }, 10_000);

  afterAll(async () => {
    if (client?.isOpen) {
      await client.quit();
    }
  });

  it('enforces hit limits and block windows using Redis atomically', async () => {
    if (!client) {
      throw new Error(skipReason ?? 'Redis client was not initialized.');
    }

    const storage = new RedisRateLimitStorage(client);
    const runId = randomUUID();
    const throttlerName = `int-${runId}`;
    const requestKey = `request-${runId}`;
    const hitsKey = `rate-limit:${throttlerName}:${requestKey}:hits`;
    const blockedKey = `rate-limit:${throttlerName}:${requestKey}:blocked`;

    try {
      await expect(
        storage.increment(requestKey, 5_000, 2, 10_000, throttlerName),
      ).resolves.toMatchObject({
        totalHits: 1,
        isBlocked: false,
        timeToBlockExpire: 0,
      });

      await expect(
        storage.increment(requestKey, 5_000, 2, 10_000, throttlerName),
      ).resolves.toMatchObject({
        totalHits: 2,
        isBlocked: false,
        timeToBlockExpire: 0,
      });

      await expect(
        storage.increment(requestKey, 5_000, 2, 10_000, throttlerName),
      ).resolves.toMatchObject({
        totalHits: 3,
        timeToExpire: 0,
        isBlocked: true,
      });

      const blockedResult = await storage.increment(
        requestKey,
        5_000,
        2,
        10_000,
        throttlerName,
      );

      expect(blockedResult).toMatchObject({
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: true,
      });
      expect(blockedResult.timeToBlockExpire).toBeGreaterThan(0);
      expect(blockedResult.timeToBlockExpire).toBeLessThanOrEqual(10);
    }
    finally {
      await client.del([hitsKey, blockedKey]);
    }
  });
});
