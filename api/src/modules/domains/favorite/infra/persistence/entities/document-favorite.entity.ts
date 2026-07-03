import { Entity, ManyToOne, Unique } from '@mikro-orm/core';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { DocumentEntity } from '~/modules/domains/document/infra/persistence/entities/document.entity';
import { WorkspaceEntity } from '~/modules/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/modules/domains/workspace/infra/persistence/entities/abstract-workspace.entity';

@Entity({ tableName: 'document_favorites' })
@Unique({ properties: ['user', 'document'] })
export class DocumentFavoriteEntity extends AbstractWorkspaceEntity {
  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => DocumentEntity, { fieldName: 'document_id' })
  document!: DocumentEntity;

  @ManyToOne(() => CurrentUserEntity, { fieldName: 'user_id' })
  user!: CurrentUserEntity;
}
