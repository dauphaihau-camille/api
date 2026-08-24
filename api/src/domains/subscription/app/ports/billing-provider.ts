import type { CheckoutSessionSummary } from '../contracts/subscription.contract';
import type { SubscriptionStatus } from '../../domain/enums/subscription-status.enum';

export type StartSubscriptionCheckoutInput = {
  workspaceId: string;
  workspaceName: string;
  customerEmail: string;
  seatCount: number;
  returnUrl?: string;
};

export type BillingProviderSubscriptionEvent = {
  eventId: string;
  eventType: string;
  provider: string;
  workspaceId?: string;
  providerCustomerId?: string;
  providerSubscriptionId: string;
  providerPriceId?: string;
  providerStatus?: string;
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
};

export abstract class BillingProvider {
  abstract startPlusCheckout(input: StartSubscriptionCheckoutInput): Promise<CheckoutSessionSummary>;

  abstract updateSubscriptionQuantity(input: {
    providerSubscriptionId: string;
    quantity: number;
  }): Promise<void>;

  abstract scheduleCancellation(input: {
    providerSubscriptionId: string;
  }): Promise<void>;

  abstract verifyWebhook(input: {
    signature?: string;
    rawBody: Buffer | string;
  }): Promise<BillingProviderSubscriptionEvent>;
}
