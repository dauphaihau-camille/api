import {
  Entity,
  Enum,
  ManyToOne,
  Property,
  Unique,
} from '@mikro-orm/core';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import { AbstractWorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/abstract-workspace.entity';
import { SubscriptionPlan } from '../../../domain/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum';

@Entity({ tableName: 'workspace_subscriptions' })
@Unique({ properties: ['workspace'] })
export class WorkspaceSubscriptionEntity extends AbstractWorkspaceEntity {
  @Property({ fieldName: 'version', version: true })
  version = 1;

  @ManyToOne(() => WorkspaceEntity, { fieldName: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @Enum({ items: () => SubscriptionPlan, fieldName: 'plan' })
  plan = SubscriptionPlan.FREE;

  @Enum({ items: () => SubscriptionStatus, fieldName: 'status' })
  status = SubscriptionStatus.FREE;

  @Property({ fieldName: 'seat_count' })
  seatCount = 1;

  @Property({ fieldName: 'current_period_start', nullable: true })
  currentPeriodStart?: Date;

  @Property({ fieldName: 'current_period_end', nullable: true })
  currentPeriodEnd?: Date;

  @Property({ fieldName: 'cancel_at_period_end' })
  cancelAtPeriodEnd = false;

  @Property({ fieldName: 'provider', nullable: true })
  provider?: string;

  @Property({ fieldName: 'provider_customer_id', nullable: true })
  providerCustomerId?: string;

  @Property({ fieldName: 'provider_subscription_id', nullable: true })
  providerSubscriptionId?: string;

  @Property({ fieldName: 'provider_price_id', nullable: true })
  providerPriceId?: string;

  @Property({ fieldName: 'provider_status', nullable: true })
  providerStatus?: string;
}
