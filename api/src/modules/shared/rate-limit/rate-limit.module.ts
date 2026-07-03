import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import {
  RATE_LIMIT_CONFIG,
  type RateLimitConfig,
} from '../../../config/rate-limit.config';
import { RateLimitInfraModule } from './rate-limit-infra.module';
import { RATE_LIMIT_STORAGE } from './rate-limit.constants';

@Module({
  imports: [
    RateLimitInfraModule,
    ThrottlerModule.forRootAsync({
      imports: [RateLimitInfraModule],
      inject: [RATE_LIMIT_CONFIG, RATE_LIMIT_STORAGE],
      useFactory: (
        rateLimitConfig: RateLimitConfig,
        storage: ThrottlerStorage,
      ) => ({
        storage,
        errorMessage: 'Too many requests.',
        throttlers: [
          {
            limit: rateLimitConfig.limit,
            ttl: rateLimitConfig.ttlMilliseconds,
            blockDuration: rateLimitConfig.blockDurationMilliseconds,
          },
        ],
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class RateLimitModule {}
