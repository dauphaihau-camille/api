import {
  Entity,
  Enum,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/core';
import type { OAuthProvider } from '../../../app/auth.types';
import { AbstractAuthEntity } from './abstract-auth.entity';
import { CurrentUserEntity } from './current-user.entity';

@Entity({ tableName: 'user_oauth_accounts' })
@Unique({ properties: ['provider', 'providerUserId'] })
export class OAuthAccountEntity extends AbstractAuthEntity {
  @ManyToOne(() => CurrentUserEntity, {
    fieldName: 'user_id',
    deleteRule: 'cascade',
  })
  user!: CurrentUserEntity;

  @Enum({
    items: ['google', 'github'],
    fieldName: 'provider',
  })
  provider!: OAuthProvider;

  @Property({ fieldName: 'provider_user_id' })
  providerUserId!: string;

  @Property({ fieldName: 'email' })
  email!: string;
}
