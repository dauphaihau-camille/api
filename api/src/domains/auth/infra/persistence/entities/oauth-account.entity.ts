import {
  Entity,
  Enum,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/core';
import type { OAuthProvider } from '../../../app/auth.types';
import { AbstractAuthEntity } from './abstract-auth.entity';
import { UserEntity } from '../../../../user/infra/persistence/entities/user.entity';

@Entity({ tableName: 'user_oauth_accounts' })
@Unique({ properties: ['provider', 'providerUserId'] })
export class OAuthAccountEntity extends AbstractAuthEntity {
  @ManyToOne(() => UserEntity, {
    fieldName: 'user_id',
    deleteRule: 'cascade',
  })
  user!: UserEntity;

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
