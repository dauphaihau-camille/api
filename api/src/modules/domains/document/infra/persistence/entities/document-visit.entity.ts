import {
  Entity, ManyToOne, Property, Unique, 
} from '@mikro-orm/core';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { WorkspaceEntity } from '~/modules/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/modules/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import { DocumentEntity } from './document.entity';

@Entity({ tableName: 'document_visits' })
@Unique({ properties: ['user', 'document'] })
export class DocumentVisitEntity extends AbstractWorkspaceEntity {
  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => DocumentEntity, { fieldName: 'document_id' })
  document!: DocumentEntity;

  @ManyToOne(() => CurrentUserEntity, { fieldName: 'user_id' })
  user!: CurrentUserEntity;

  @Property({ fieldName: 'last_visited_at' })
  lastVisitedAt = new Date();
}
