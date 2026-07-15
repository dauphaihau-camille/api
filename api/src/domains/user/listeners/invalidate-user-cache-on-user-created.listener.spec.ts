import type { Cache } from 'cache-manager';
import { UserCreatedEvent } from '../events/user-created.event';
import { InvalidateUserCacheOnUserCreatedListener } from './invalidate-user-cache-on-user-created.listener';

describe('InvalidateUserCacheOnUserCreatedListener', () => {
  it('removes the user cache entry', async () => {
    const cacheManager = {
      del: jest.fn().mockResolvedValue(undefined),
    } satisfies Pick<Cache, 'del'>;
    const listener = new InvalidateUserCacheOnUserCreatedListener(
      cacheManager as unknown as Cache,
    );

    await listener.handle(new UserCreatedEvent('user-1', 'user@example.com'));

    expect(cacheManager.del).toHaveBeenCalledWith('user:id:user-1');
  });
});
