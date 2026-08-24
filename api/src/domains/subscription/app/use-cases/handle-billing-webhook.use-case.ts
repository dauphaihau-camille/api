import { Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../domain/enums/subscription-status.enum';
import type { BillingWebhookResult } from '../contracts/subscription.contract';
import { BillingProvider } from '../ports/billing-provider';
import { SubscriptionRepository } from '../ports/subscription.repository';

@Injectable()
export class HandleBillingWebhookUseCase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly billingProvider: BillingProvider,
  ) {}

  async execute(input: {
    signature?: string;
    rawBody: Buffer | string;
  }): Promise<BillingWebhookResult> {
    const event = await this.billingProvider.verifyWebhook(input);

    const subscription = await this.subscriptionRepository.findByProviderSubscriptionId(
      event.providerSubscriptionId,
    );

    const workspaceId = subscription?.workspaceId ?? event.workspaceId;

    if (!workspaceId) {
      return {
        eventId: event.eventId,
        eventType: event.eventType,
        handled: false,
      };
    }

    await this.subscriptionRepository.updateSubscription({
      workspaceId,
      plan: event.status === SubscriptionStatus.FREE ? SubscriptionPlan.FREE : SubscriptionPlan.PLUS,
      status: event.status,
      currentPeriodStart: event.currentPeriodStart,
      currentPeriodEnd: event.currentPeriodEnd,
      cancelAtPeriodEnd: event.cancelAtPeriodEnd ?? false,
      provider: event.provider,
      providerCustomerId: event.providerCustomerId,
      providerSubscriptionId: event.providerSubscriptionId,
      providerPriceId: event.providerPriceId,
      providerStatus: event.providerStatus,
    });

    return {
      eventId: event.eventId,
      eventType: event.eventType,
      handled: true,
    };
  }
}
