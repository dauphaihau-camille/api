import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { UserRepository } from '../ports/user.repository';
import type { UserSummary } from '../user.types';
import { buildUserByIdCacheKey } from '../user-cache.keys';

@Injectable()
export class GetUserByIdUseCase {
  private readonly logger = new Logger(GetUserByIdUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async execute(id: string): Promise<UserSummary | null> {
    const cacheKey = buildUserByIdCacheKey(id);
    const cachedUser = await this.readFromCache(cacheKey);

    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.userRepository.findById(id);

    if (user) {
      await this.writeToCache(cacheKey, user);
    }

    return user;
  }

  private async readFromCache(cacheKey: string): Promise<UserSummary | undefined> {
    try {
      return await this.cacheManager.get<UserSummary>(cacheKey);
    }
    catch (error) {
      this.logger.warn(
        `User cache read failed, continuing without cache: ${this.toErrorMessage(error)}`,
      );
      return undefined;
    }
  }

  private async writeToCache(cacheKey: string, user: UserSummary): Promise<void> {
    try {
      await this.cacheManager.set(cacheKey, user);
    }
    catch (error) {
      this.logger.warn(
        `User cache write failed, continuing without cache: ${this.toErrorMessage(error)}`,
      );
    }
  }

  private toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
