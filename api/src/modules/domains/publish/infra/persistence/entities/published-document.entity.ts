import { Entity, ManyToOne, OneToOne, Unique } from '@mikro-orm/core';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { DocumentEntity } from '~/modules/domains/document/infra/persistence/entities/document.entity';
import { WorkspaceEntity } from '~/modules/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/modules/domains/workspace/infra/persistence/entities/abstract-workspace.entity';

@Entity({ tableName: 'published_documents' })
@Unique({ properties: ['document'] })
export class PublishedDocumentEntity extends AbstractWorkspaceEntity {
  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @OneToOne(() => DocumentEntity, { fieldName: 'document_id' })
  document!: DocumentEntity;

  @ManyToOne(() => CurrentUserEntity, { fieldName: 'published_by' })
  publishedBy!: CurrentUserEntity;
}
