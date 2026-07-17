import type { StorageService } from './ports/storage.service';
import { UserAvatarSourceType } from '~/domains/auth/domain/models/user-avatar';
import { resolveUserAvatarUrl } from './user-avatar-url.util';

describe('user avatar url util', () => {
  const storageService: Pick<StorageService, 'getPublicUrl'> = {
    getPublicUrl: jest.fn((key: string) => `https://cdn.example.com/${key}`),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns external avatar urls as-is', () => {
    expect(
      resolveUserAvatarUrl(
        {
          avatarSourceType: UserAvatarSourceType.EXTERNAL,
          avatarSourceUrl: 'https://avatars.githubusercontent.com/u/73809318?v=4',
        },
        storageService,
      ),
    ).toBe('https://avatars.githubusercontent.com/u/73809318?v=4');
    expect(storageService.getPublicUrl).not.toHaveBeenCalled();
  });

  it('expands internal storage keys into public urls', () => {
    expect(
      resolveUserAvatarUrl(
        {
          avatarSourceType: UserAvatarSourceType.INTERNAL,
          avatarStorageKey: 'avatars/users/user-1/original.png',
        },
        storageService,
      ),
    ).toBe('https://cdn.example.com/avatars/users/user-1/original.png');
    expect(storageService.getPublicUrl).toHaveBeenCalledWith(
      'avatars/users/user-1/original.png',
    );
  });

  it('returns undefined when no avatar is configured', () => {
    expect(resolveUserAvatarUrl({}, storageService)).toBeUndefined();
  });
});
