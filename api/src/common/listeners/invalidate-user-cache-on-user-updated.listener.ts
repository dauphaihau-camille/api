import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Cache } from 'cache-manager';
import { buildUserByIdCacheKey } from '../../modules/domains/user/app/user-cache.keys';
import { UserUpdatedEvent } from '../events/user-updated.event';

@Injectable()
export class InvalidateUserCacheOnUserUpdatedListener {
  private readonly logger = new Logger(
    InvalidateUserCacheOnUserUpdatedListener.name,
  );

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @OnEvent('user.updated', { async: true, suppressErrors: true })
  async handle(event: UserUpdatedEvent): Promise<void> {
    try {
      await this.cacheManager.del(buildUserByIdCacheKey(event.userId));
    }
    catch (error) {
      this.logger.warn(
        `User cache invalidation failed after update, continuing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
