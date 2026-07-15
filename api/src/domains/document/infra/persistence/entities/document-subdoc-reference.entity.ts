import { Entity, ManyToOne, Unique } from '@mikro-orm/core';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import { DocumentEntity } from './document.entity';

@Entity({ tableName: 'document_subdoc_references' })
@Unique({ properties: ['sourceDocument', 'targetDocument'] })
export class DocumentSubdocReferenceEntity extends AbstractWorkspaceEntity {
  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => DocumentEntity, { fieldName: 'source_document_id' })
  sourceDocument!: DocumentEntity;

  @ManyToOne(() => DocumentEntity, { fieldName: 'target_document_id' })
  targetDocument!: DocumentEntity;
}
