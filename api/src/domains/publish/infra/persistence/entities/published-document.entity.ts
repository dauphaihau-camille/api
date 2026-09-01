import {
  Entity, ManyToOne, OneToOne, Unique, 
} from '@mikro-orm/core';
import { UserEntity } from '../../../../user/infra/persistence/entities/user.entity';
import { DocumentEntity } from '~/domains/document/infra/persistence/entities/document.entity';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';

@Entity({ tableName: 'published_documents' })
@Unique({ properties: ['document'] })
export class PublishedDocumentEntity extends AbstractWorkspaceEntity {
  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @OneToOne(() => DocumentEntity, { fieldName: 'document_id' })
  document!: DocumentEntity;

  @ManyToOne(() => UserEntity, { fieldName: 'published_by' })
  publishedBy!: UserEntity;
}
