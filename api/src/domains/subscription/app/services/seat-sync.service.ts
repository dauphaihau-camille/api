import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';
import { SubscriptionRepository } from '../ports/subscription.repository';
import { BillingProvider } from '../ports/billing-provider';

@Injectable()
export class SeatSyncService {
  private readonly logger = new Logger(SeatSyncService.name);

  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly billingProvider: BillingProvider,
  ) {}

  async syncWorkspaceSeats(workspaceId: string): Promise<void> {
    const [subscription, seatCount] = await Promise.all([
      this.subscriptionRepository.findByWorkspaceId(workspaceId),
      this.subscriptionRepository.countBillableMembers(workspaceId),
    ]);

    if (!subscription) {
      await this.subscriptionRepository.getOrCreateFreeSubscription({
        workspaceId,
        seatCount,
      });
      return;
    }

    await this.subscriptionRepository.updateSubscription({
      workspaceId,
      seatCount,
    });

    if (
      subscription.plan !== SubscriptionPlan.PLUS
      || !subscription.providerSubscriptionId
    ) {
      return;
    }

    try {
      await this.billingProvider.updateSubscriptionQuantity({
        providerSubscriptionId: subscription.providerSubscriptionId,
        quantity: seatCount,
      });
    }
    catch (error) {
      this.logger.warn({
        err: error,
        workspaceId,
        providerSubscriptionId: subscription.providerSubscriptionId,
      }, 'Failed to sync subscription seat quantity');
    }
  }
}
