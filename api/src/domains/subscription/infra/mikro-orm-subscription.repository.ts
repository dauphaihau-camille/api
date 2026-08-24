import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { countContentBlocks } from '~/domains/document/app/utils/document-content.util';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import { WorkspaceMemberEntity } from '~/domains/workspace/infra/persistence/entities/workspace-member.entity';
import type { WorkspaceSubscriptionRecord } from '../app/contracts/subscription.contract';
import { SubscriptionRepository } from '../app/ports/subscription.repository';
import { SubscriptionPlan } from '../domain/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../domain/enums/subscription-status.enum';
import { WorkspaceSubscriptionEntity } from './persistence/entities/workspace-subscription.entity';

@Injectable()
export class MikroOrmSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceSubscriptionRecord | null> {
    const subscription = await this.entityManager.fork().findOne(
      WorkspaceSubscriptionEntity,
      { workspace: workspaceId },
    );

    return subscription ? this.toRecord(subscription) : null;
  }

  async findByProviderSubscriptionId(
    providerSubscriptionId: string,
  ): Promise<WorkspaceSubscriptionRecord | null> {
    const subscription = await this.entityManager.fork().findOne(
      WorkspaceSubscriptionEntity,
      { providerSubscriptionId },
    );

    return subscription ? this.toRecord(subscription) : null;
  }

  async getOrCreateFreeSubscription(input: {
    workspaceId: string;
    seatCount: number;
  }): Promise<WorkspaceSubscriptionRecord> {
    const entityManager = this.entityManager.fork();

    const existing = await entityManager.findOne(
      WorkspaceSubscriptionEntity,
      { workspace: input.workspaceId },
    );

    if (existing) {
      if (existing.seatCount !== input.seatCount) {
        existing.seatCount = input.seatCount;
        await entityManager.persist(existing).flush();
      }
      return this.toRecord(existing);
    }

    const workspace = await entityManager.findOneOrFail(WorkspaceEntity, {
      id: input.workspaceId,
    });

    const subscription = entityManager.create(WorkspaceSubscriptionEntity, {
      workspace,
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.FREE,
      seatCount: input.seatCount,
      cancelAtPeriodEnd: false,
    });

    await entityManager.persist(subscription).flush();

    return this.toRecord(subscription);
  }

  async countBillableMembers(workspaceId: string): Promise<number> {
    return this.entityManager.fork().count(WorkspaceMemberEntity, {
      workspace: workspaceId,
    });
  }

  async countWorkspaceBlocks(workspaceId: string): Promise<number> {
    const rows = await this.entityManager.fork().getConnection().execute<Array<{ content_json: unknown }>>(
      `
        select d.content_json
        from documents d
        where d.workspace_id = ?
          and d.archived_at is null
      `,
      [workspaceId],
    );

    return rows.reduce(
      (count, row) => count + countContentBlocks(row.content_json),
      0,
    );
  }

  async updateSubscription(input: {
    workspaceId: string;
    plan?: SubscriptionPlan;
    status?: SubscriptionStatus;
    seatCount?: number;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
    provider?: string;
    providerCustomerId?: string;
    providerSubscriptionId?: string;
    providerPriceId?: string;
    providerStatus?: string;
  }): Promise<WorkspaceSubscriptionRecord> {
    const entityManager = this.entityManager.fork();

    const subscription = await entityManager.findOneOrFail(
      WorkspaceSubscriptionEntity,
      { workspace: input.workspaceId },
    );

    if (input.plan !== undefined) {
      subscription.plan = input.plan;
    }
    if (input.status !== undefined) {
      subscription.status = input.status;
    }
    if (input.seatCount !== undefined) {
      subscription.seatCount = input.seatCount;
    }
    if (input.currentPeriodStart !== undefined) {
      subscription.currentPeriodStart = input.currentPeriodStart;
    }
    if (input.currentPeriodEnd !== undefined) {
      subscription.currentPeriodEnd = input.currentPeriodEnd;
    }
    if (input.cancelAtPeriodEnd !== undefined) {
      subscription.cancelAtPeriodEnd = input.cancelAtPeriodEnd;
    }
    if (input.provider !== undefined) {
      subscription.provider = input.provider;
    }
    if (input.providerCustomerId !== undefined) {
      subscription.providerCustomerId = input.providerCustomerId;
    }
    if (input.providerSubscriptionId !== undefined) {
      subscription.providerSubscriptionId = input.providerSubscriptionId;
    }
    if (input.providerPriceId !== undefined) {
      subscription.providerPriceId = input.providerPriceId;
    }
    if (input.providerStatus !== undefined) {
      subscription.providerStatus = input.providerStatus;
    }

    await entityManager.persist(subscription).flush();

    return this.toRecord(subscription);
  }

  private toRecord(subscription: WorkspaceSubscriptionEntity): WorkspaceSubscriptionRecord {
    return {
      id: subscription.id,
      version: subscription.version,
      workspaceId: subscription.workspace.id,
      plan: subscription.plan,
      status: subscription.status,
      seatCount: subscription.seatCount,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      provider: subscription.provider,
      providerCustomerId: subscription.providerCustomerId,
      providerSubscriptionId: subscription.providerSubscriptionId,
      providerPriceId: subscription.providerPriceId,
      providerStatus: subscription.providerStatus,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }
}
