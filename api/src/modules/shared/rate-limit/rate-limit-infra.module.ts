import {
  ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import {
  RATE_LIMIT_CONFIG,
  buildRateLimitConfig,
} from '../../../config/rate-limit.config';
import { ObservabilityModule } from '../observability/observability.module';
import { ObservabilityService } from '../observability/observability.service';
import { RedisRateLimitStorage } from './infra/redis-rate-limit.storage';
import { RATE_LIMIT_STORAGE } from './rate-limit.constants';

@Module({
  imports: [ConfigModule, ObservabilityModule],
  providers: [
    {
      provide: RATE_LIMIT_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildRateLimitConfig(configService),
    },
    {
      provide: RATE_LIMIT_STORAGE,
      inject: [RATE_LIMIT_CONFIG, ObservabilityService],
      useFactory: async (
        rateLimitConfig: ReturnType<typeof buildRateLimitConfig>,
        observabilityService: ObservabilityService,
      ): Promise<ThrottlerStorage> => {
        if (rateLimitConfig.driver === 'memory') {
          return new ThrottlerStorageService();
        }

        const client = createClient({
          url: rateLimitConfig.redisUrl,
        });

        client.on('error', () => {
          observabilityService.recordRedisConnectionError('rate-limit');
        });

        try {
          await client.connect();
        }
        catch {
          observabilityService.recordRedisConnectionError('rate-limit');
          await client.destroy();
          return new ThrottlerStorageService();
        }

        return new RedisRateLimitStorage(
          client,
          new ThrottlerStorageService(),
          () => {
            observabilityService.recordRedisConnectionError('rate-limit');
          },
        );
      },
    },
  ],
  exports: [RATE_LIMIT_CONFIG, RATE_LIMIT_STORAGE],
})
export class RateLimitInfraModule {}
