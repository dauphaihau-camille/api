import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Cache } from 'cache-manager';
import { buildUserByIdCacheKey } from '../../modules/domains/user/app/user-cache.keys';
import { UserCreatedEvent } from '../events/user-created.event';

@Injectable()
export class InvalidateUserCacheOnUserCreatedListener {
  private readonly logger = new Logger(
    InvalidateUserCacheOnUserCreatedListener.name,
  );

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @OnEvent('user.created', { async: true, suppressErrors: true })
  async handle(event: UserCreatedEvent): Promise<void> {
    try {
      await this.cacheManager.del(buildUserByIdCacheKey(event.userId));
    }
    catch (error) {
      this.logger.warn(
        `User cache invalidation failed after create, continuing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
