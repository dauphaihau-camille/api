import {
  Entity,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/core';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import { DocumentEntity } from './document.entity';

@Entity({ tableName: 'document_collaboration_snapshots' })
@Unique({ properties: ['document'] })
export class DocumentCollaborationSnapshotEntity extends AbstractWorkspaceEntity {
  @ManyToOne(() => DocumentEntity, {
    fieldName: 'document_id',
    deleteRule: 'cascade',
  })
  document!: DocumentEntity;

  @Property({ fieldName: 'snapshot', type: 'blob' })
  snapshot!: Buffer;

  @Property({ fieldName: 'sequence' })
  sequence = 0;

  @Property({ fieldName: 'latest_sequence' })
  latestSequence = 0;

  @Property({ fieldName: 'projection_sequence' })
  projectionSequence = 0;
}
