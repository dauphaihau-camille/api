import {
  Entity,
  Enum,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/core';
import { UserEntity } from '../../../../user/infra/persistence/entities/user.entity';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import { DocumentAccessGrantPermission } from '../../../domain/enums/document-access-grant-permission.enum';
import { DocumentEntity } from './document.entity';

@Entity({ tableName: 'document_access_grants' })
@Unique({ properties: ['document', 'user'] })
export class DocumentAccessGrantEntity extends AbstractWorkspaceEntity {
  @Property({ fieldName: 'version', version: true })
  version = 1;

  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => DocumentEntity, { fieldName: 'document_id' })
  document!: DocumentEntity;

  @ManyToOne(() => UserEntity, { fieldName: 'user_id' })
  user!: UserEntity;

  @Enum({ items: () => DocumentAccessGrantPermission, fieldName: 'permission' })
  permission!: DocumentAccessGrantPermission;

  @ManyToOne(() => UserEntity, { fieldName: 'granted_by' })
  grantedBy!: UserEntity;

  @Property({ fieldName: 'revoked_at', nullable: true })
  revokedAt?: Date;
}
