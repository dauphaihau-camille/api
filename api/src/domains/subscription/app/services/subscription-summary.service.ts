import { Injectable } from '@nestjs/common';
import type { SubscriptionSummary } from '../contracts/subscription.contract';
import { SubscriptionRepository } from '../ports/subscription.repository';
import { SubscriptionEntitlementService } from './subscription-entitlement.service';

@Injectable()
export class SubscriptionSummaryService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly entitlementService: SubscriptionEntitlementService,
  ) {}

  async getSummary(workspaceId: string): Promise<SubscriptionSummary> {
    const seatCount = await this.subscriptionRepository.countBillableMembers(workspaceId);

    const subscription = await this.subscriptionRepository.getOrCreateFreeSubscription({
      workspaceId,
      seatCount,
    });

    const blockCount = await this.subscriptionRepository.countWorkspaceBlocks(workspaceId);

    const entitlements = this.entitlementService.resolveEntitlements({
      plan: subscription.plan,
      seatCount,
    });

    return {
      workspaceId,
      plan: subscription.plan,
      status: subscription.status,
      seatCount,
      blockCount,
      blockLimit: entitlements.maxBlocks,
      entitlements,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      providerStatus: subscription.providerStatus,
    };
  }
}
