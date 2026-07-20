import {
  Entity,
  Index,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/core';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import { DocumentEntity } from './document.entity';

@Entity({ tableName: 'document_collaboration_updates' })
@Unique({ properties: ['document', 'sequence'] })
@Unique({ properties: ['document', 'updateHash'] })
@Index({ properties: ['document', 'sequence'] })
export class DocumentCollaborationUpdateEntity extends AbstractWorkspaceEntity {
  @ManyToOne(() => DocumentEntity, {
    fieldName: 'document_id',
    deleteRule: 'cascade',
  })
  document!: DocumentEntity;

  @Property({ fieldName: 'sequence' })
  sequence!: number;

  @Property({ fieldName: 'update_hash', length: 64 })
  updateHash!: string;

  @Property({ fieldName: 'update', type: 'blob' })
  update!: Buffer;
}
