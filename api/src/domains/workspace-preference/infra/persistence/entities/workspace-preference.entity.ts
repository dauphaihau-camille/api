import {
  Entity, ManyToOne, Property, Unique, 
} from '@mikro-orm/core';
import { UserEntity } from '../../../../user/infra/persistence/entities/user.entity';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import type { ExpandedDocumentIdsByScope } from '../../../app/workspace-preference.types';

@Entity({ tableName: 'workspace_user_preferences' })
@Unique({ properties: ['user', 'workspace'] })
export class WorkspacePreferenceEntity extends AbstractWorkspaceEntity {
  @ManyToOne(() => UserEntity, { fieldName: 'user_id' })
  user!: UserEntity;

  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @Property({ fieldName: 'expanded_document_ids_by_scope', type: 'json' })
  expandedDocumentIdsByScope: ExpandedDocumentIdsByScope = {};

  @Property({ fieldName: 'last_active_at', type: 'timestamptz', nullable: true })
  lastActiveAt: Date | null = null;
}
