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

@Entity({ tableName: 'document_access_settings' })
@Unique({ properties: ['document'] })
export class DocumentAccessSettingEntity extends AbstractWorkspaceEntity {
  @Property({ fieldName: 'version', version: true })
  version = 1;

  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => DocumentEntity, { fieldName: 'document_id' })
  document!: DocumentEntity;

  @Enum({
    items: () => DocumentAccessGrantPermission,
    fieldName: 'workspace_member_permission',
    nullable: true,
  })
  workspaceMemberPermission?: DocumentAccessGrantPermission;

  @ManyToOne(() => CurrentUserEntity, { fieldName: 'updated_by' })
  updatedBy!: CurrentUserEntity;
}
