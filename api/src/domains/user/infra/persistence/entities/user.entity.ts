import {
  Entity,
  Enum,
  OptionalProps,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import { UserAvatarSourceType } from '~/domains/auth/domain/models/user-avatar';

@Entity({ tableName: 'users' })
export class UserEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'version';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ fieldName: 'created_at' })
  createdAt = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt = new Date();

  @Property({ fieldName: 'version', version: true })
  version = 1;

  @Property({ fieldName: 'email' })
  @Unique()
  email!: string;

  @Property({ fieldName: 'display_name', nullable: true })
  displayName?: string;

  @Enum({
    items: () => UserAvatarSourceType,
    fieldName: 'avatar_source_type',
    nullable: true,
  })
  avatarSourceType?: UserAvatarSourceType;

  @Property({ fieldName: 'avatar_source_url', nullable: true })
  avatarSourceUrl?: string;

  @Property({ fieldName: 'avatar_storage_key', nullable: true })
  avatarStorageKey?: string;

  @Enum({ items: () => UserStatus, fieldName: 'status' })
  status = UserStatus.ACTIVE;

  @Property({ fieldName: 'email_verified_at', nullable: true })
  emailVerifiedAt?: Date;
}
