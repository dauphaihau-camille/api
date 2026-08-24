import { Injectable } from '@nestjs/common';
import { BillingWebhookVerificationError } from '../errors/subscription-app.error';
import {
  BillingProvider,
  type BillingProviderSubscriptionEvent,
  type StartSubscriptionCheckoutInput,
} from '../ports/billing-provider';
import type { CheckoutSessionSummary } from '../contracts/subscription.contract';

@Injectable()
export class NoopBillingProvider implements BillingProvider {
  async startPlusCheckout(
    input: StartSubscriptionCheckoutInput,
  ): Promise<CheckoutSessionSummary> {
    return {
      sessionId: `noop_plus_${input.workspaceId}`,
      checkoutUrl: input.returnUrl ?? `/w/${input.workspaceId}/settings/billing?checkout=success`,
    };
  }

  async updateSubscriptionQuantity(): Promise<void> {
    return undefined;
  }

  async scheduleCancellation(): Promise<void> {
    return undefined;
  }

  async verifyWebhook(): Promise<BillingProviderSubscriptionEvent> {
    throw new BillingWebhookVerificationError();
  }
}
