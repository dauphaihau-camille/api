import {
  Entity,
  Enum,
  ManyToOne,
  Property,
} from '@mikro-orm/core';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';

export type AiResponseReservationStatus = 'reserved' | 'consumed' | 'released';

@Entity({ tableName: 'ai_response_reservations' })
export class AiResponseReservationEntity extends AbstractWorkspaceEntity {
  @Property({ fieldName: 'version', version: true })
  version = 1;

  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @Enum({ fieldName: 'status', items: ['reserved', 'consumed', 'released'] })
  status: AiResponseReservationStatus = 'reserved';

  @Property({ fieldName: 'expires_at' })
  expiresAt!: Date;
}
