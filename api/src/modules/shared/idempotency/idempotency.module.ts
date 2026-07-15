import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { IdempotencyKeyInterceptor } from '../../../common/interceptors/idempotency-key.interceptor';
import { IDEMPOTENCY_REDIS } from '../../../common/interceptors/idempotency.constants';
import { buildCacheConfig } from '../../../config/cache.config';
import { CacheModule } from '../cache/cache.module';
import { ObservabilityModule } from '../observability/observability.module';
import { ObservabilityService } from '../observability/observability.service';

@Module({
  imports: [ConfigModule, CacheModule, ObservabilityModule],
  providers: [
    {
      provide: IDEMPOTENCY_REDIS,
      inject: [ConfigService, ObservabilityService],
      useFactory: async (
        configService: ConfigService,
        observabilityService: ObservabilityService,
      ) => {
        const cacheConfig = buildCacheConfig(configService);

        if (cacheConfig.driver !== 'redis') {
          return null;
        }

        const client = createClient({
          url: cacheConfig.redisUrl,
        });

        client.on('error', () => {
          observabilityService.recordRedisConnectionError('idempotency');
        });

        try {
          await client.connect();
        }
        catch {
          observabilityService.recordRedisConnectionError('idempotency');
          client.destroy();
          return null;
        }

        return client;
      },
    },
    IdempotencyKeyInterceptor,
  ],
  exports: [IDEMPOTENCY_REDIS, IdempotencyKeyInterceptor],
})
export class IdempotencyModule {}
