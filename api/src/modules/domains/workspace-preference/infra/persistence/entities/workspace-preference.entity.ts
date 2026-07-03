import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/core';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { WorkspaceEntity } from '~/modules/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/modules/domains/workspace/infra/persistence/entities/abstract-workspace.entity';

@Entity({ tableName: 'workspace_sidebar_preferences' })
@Unique({ properties: ['user', 'workspace'] })
export class WorkspacePreferenceEntity extends AbstractWorkspaceEntity {
  @ManyToOne(() => CurrentUserEntity, { fieldName: 'user_id' })
  user!: CurrentUserEntity;

  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @Property({ fieldName: 'expanded_document_ids', type: 'json' })
  expandedDocumentIds: string[] = [];
}
