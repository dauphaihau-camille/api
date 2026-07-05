import { Entity, Index, Property } from '@mikro-orm/core';
import { AbstractAuthEntity } from './abstract-auth.entity';

@Entity({ tableName: 'email_login_challenges' })
export class EmailLoginChallengeEntity extends AbstractAuthEntity {
  @Property({ fieldName: 'email' })
  @Index()
  email!: string;

  @Property({ fieldName: 'code_hash' })
  codeHash!: string;

  @Property({ fieldName: 'expires_at' })
  expiresAt!: Date;

  @Property({ fieldName: 'consumed_at', nullable: true })
  consumedAt?: Date;
}
