import {
  Entity, ManyToOne, Property, Unique, 
} from '@mikro-orm/core';
import { CurrentUserEntity } from '~/domains/auth/infra/persistence/entities/current-user.entity';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';

@Entity({ tableName: 'workspace_user_preferences' })
@Unique({ properties: ['user', 'workspace'] })
export class WorkspacePreferenceEntity extends AbstractWorkspaceEntity {
  @ManyToOne(() => CurrentUserEntity, { fieldName: 'user_id' })
  user!: CurrentUserEntity;

  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @Property({ fieldName: 'expanded_document_ids', type: 'json' })
  expandedDocumentIds: string[] = [];

  @Property({ fieldName: 'last_active_at', type: 'timestamptz', nullable: true })
  lastActiveAt: Date | null = null;
}
