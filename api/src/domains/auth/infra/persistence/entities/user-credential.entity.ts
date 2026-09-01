import {
  Entity, OneToOne, Property, Unique,
} from '@mikro-orm/core';
import { UserEntity } from '~/domains/user/infra/persistence/entities/user.entity';
import { AbstractAuthEntity } from './abstract-auth.entity';

@Entity({ tableName: 'user_credentials' })
export class UserCredentialEntity extends AbstractAuthEntity {
  @OneToOne(() => UserEntity, {
    owner: true,
    fieldName: 'user_id',
    deleteRule: 'cascade',
  })
  @Unique()
  user!: UserEntity;

  @Property({ fieldName: 'password_hash' })
  passwordHash!: string;

  @Property({ fieldName: 'password_updated_at' })
  passwordUpdatedAt = new Date();
}
