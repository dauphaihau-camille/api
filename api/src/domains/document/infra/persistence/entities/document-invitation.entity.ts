import {
  Entity,
  Enum,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/core';
import { CurrentUserEntity } from '~/domains/auth/infra/persistence/entities/current-user.entity';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import { DocumentAccessGrantPermission } from '../../../domain/enums/document-access-grant-permission.enum';
import { DocumentEntity } from './document.entity';

@Entity({ tableName: 'document_invitations' })
@Unique({ properties: ['document', 'email'] })
export class DocumentInvitationEntity extends AbstractWorkspaceEntity {
  @Property({ fieldName: 'version', version: true })
  version = 1;

  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => DocumentEntity, { fieldName: 'document_id' })
  document!: DocumentEntity;

  @Property({ fieldName: 'email' })
  email!: string;

  @Enum({ items: () => DocumentAccessGrantPermission, fieldName: 'permission' })
  permission!: DocumentAccessGrantPermission;

  @ManyToOne(() => CurrentUserEntity, { fieldName: 'invited_by' })
  invitedBy!: CurrentUserEntity;

  @ManyToOne(() => CurrentUserEntity, {
    fieldName: 'accepted_by',
    nullable: true,
  })
  acceptedBy?: CurrentUserEntity;

  @Property({ fieldName: 'accepted_at', nullable: true })
  acceptedAt?: Date;

  @Property({ fieldName: 'revoked_at', nullable: true })
  revokedAt?: Date;
}
