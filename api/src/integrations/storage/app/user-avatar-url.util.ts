import type { UserAvatarFields } from '~/domains/auth/domain/models/user-avatar';
import { UserAvatarSourceType } from '~/domains/auth/domain/models/user-avatar';
import type { StorageService } from './ports/storage.service';

export function resolveUserAvatarUrl(
  avatar: UserAvatarFields,
  storageService: Pick<StorageService, 'getPublicUrl'>,
): string | undefined {
  if (
    avatar.avatarSourceType === UserAvatarSourceType.INTERNAL
    && avatar.avatarStorageKey
  ) {
    return storageService.getPublicUrl(avatar.avatarStorageKey) ?? avatar.avatarStorageKey;
  }

  if (
    avatar.avatarSourceType === UserAvatarSourceType.EXTERNAL
    && avatar.avatarSourceUrl
  ) {
    return avatar.avatarSourceUrl;
  }

  return undefined;
}
