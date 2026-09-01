import { Entity, ManyToOne, Unique } from '@mikro-orm/core';
import { UserEntity } from '../../../../user/infra/persistence/entities/user.entity';
import { DocumentEntity } from '~/domains/document/infra/persistence/entities/document.entity';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';

@Entity({ tableName: 'document_favorites' })
@Unique({ properties: ['user', 'document'] })
export class DocumentFavoriteEntity extends AbstractWorkspaceEntity {
  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => DocumentEntity, { fieldName: 'document_id' })
  document!: DocumentEntity;

  @ManyToOne(() => UserEntity, { fieldName: 'user_id' })
  user!: UserEntity;
}
