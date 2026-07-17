export enum UserAvatarSourceType {
  EXTERNAL = 'external',
  INTERNAL = 'internal',
}

export interface UserAvatarFields {
  avatarSourceType?: UserAvatarSourceType;
  avatarSourceUrl?: string;
  avatarStorageKey?: string;
}
