import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import {
  BillingWebhookVerificationError,
  SubscriptionInvalidReturnUrlError,
} from '~/domains/subscription/app/errors/subscription-app.error';
import {
  BillingProvider,
  type BillingProviderSubscriptionEvent,
  type StartSubscriptionCheckoutInput,
} from '~/domains/subscription/app/ports/billing-provider';
import type { CheckoutSessionSummary } from '~/domains/subscription/app/contracts/subscription.contract';
import { SubscriptionStatus } from '~/domains/subscription/domain/enums/subscription-status.enum';
import type { PaymentConfig } from '~/platform/config/payment.config';
import { buildStripeCheckoutRedirectUrl } from './stripe-checkout-redirect-url';

export type StripeBillingClient = {
  checkout: {
    sessions: {
      create(params: Stripe.Checkout.SessionCreateParams): Promise<Stripe.Checkout.Session>;
    };
  };
  subscriptionItems: {
    update(
      id: string,
      params: Stripe.SubscriptionItemUpdateParams,
    ): Promise<Stripe.SubscriptionItem>;
  };
  subscriptions: {
    retrieve(
      id: string,
      params?: Stripe.SubscriptionRetrieveParams,
    ): Promise<Stripe.Subscription>;
    update(
      id: string,
      params: Stripe.SubscriptionUpdateParams,
    ): Promise<Stripe.Subscription>;
  };
  webhooks: {
    constructEvent(
      payload: Buffer | string,
      header: string,
      secret: string,
    ): Stripe.Event;
  };
};

@Injectable()
export class StripeSubscriptionBillingProvider implements BillingProvider {
  private readonly stripe: StripeBillingClient;

  constructor(
    private readonly paymentConfig: PaymentConfig,
    stripeClient?: StripeBillingClient,
  ) {
    this.stripe = stripeClient ?? new Stripe(
      requireConfig(paymentConfig.stripeSecretKey, 'STRIPE_SECRET_KEY'),
      {
        maxNetworkRetries: 2,
        timeout: 10_000,
      },
    );
  }

  async startPlusCheckout(
    input: StartSubscriptionCheckoutInput,
  ): Promise<CheckoutSessionSummary> {
    const session = await this.stripe.checkout.sessions.create({
      cancel_url: buildStripeCheckoutRedirectUrl({
        paymentConfig: this.paymentConfig,
        pathOrUrl: input.returnUrl ?? this.paymentConfig.cancelPath,
        query: {
          checkout: 'cancelled',
          workspace_id: input.workspaceId,
        },
        createInvalidUrlError: () => new SubscriptionInvalidReturnUrlError(),
      }),
      customer_email: input.customerEmail,
      line_items: [
        {
          price: requireConfig(
            this.paymentConfig.stripePlusPriceId,
            'STRIPE_PLUS_PRICE_ID',
          ),
          quantity: input.seatCount,
        },
      ],
      metadata: {
        workspace_id: input.workspaceId,
        workspace_name: input.workspaceName,
      },
      mode: 'subscription',
      subscription_data: {
        metadata: {
          workspace_id: input.workspaceId,
        },
      },
      success_url: buildStripeCheckoutRedirectUrl({
        paymentConfig: this.paymentConfig,
        pathOrUrl: input.returnUrl ?? this.paymentConfig.successPath,
        query: {
          checkout: 'success',
          workspace_id: input.workspaceId,
          checkout_session_id: '{CHECKOUT_SESSION_ID}',
        },
        createInvalidUrlError: () => new SubscriptionInvalidReturnUrlError(),
      }),
    });

    return {
      sessionId: session.id,
      checkoutUrl: requireConfig(session.url, 'Stripe checkout session URL'),
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  async updateSubscriptionQuantity(input: {
    providerSubscriptionId: string;
    quantity: number;
  }): Promise<void> {
    const subscription = await this.stripe.subscriptions.retrieve(
      input.providerSubscriptionId,
      { expand: ['items.data.price'] },
    );
    const subscriptionItem = findPlusSubscriptionItem(
      subscription,
      requireConfig(this.paymentConfig.stripePlusPriceId, 'STRIPE_PLUS_PRICE_ID'),
    );

    await this.stripe.subscriptionItems.update(subscriptionItem.id, {
      quantity: input.quantity,
    });
  }

  async scheduleCancellation(input: {
    providerSubscriptionId: string;
  }): Promise<void> {
    await this.stripe.subscriptions.update(input.providerSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  async verifyWebhook(input: {
    signature?: string;
    rawBody: Buffer | string;
  }): Promise<BillingProviderSubscriptionEvent> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        input.rawBody,
        requireConfig(input.signature, 'stripe-signature'),
        requireConfig(this.paymentConfig.stripeWebhookSecret, 'STRIPE_WEBHOOK_SECRET'),
      );
      const subscription = event.data.object;

      if (!isStripeSubscription(subscription)) {
        throw new BillingWebhookVerificationError();
      }

      return {
        eventId: event.id,
        eventType: event.type,
        provider: 'stripe',
        workspaceId: readMetadataValue(subscription.metadata, 'workspace_id'),
        providerCustomerId: readStripeIdentifier(subscription.customer),
        providerSubscriptionId: subscription.id,
        providerPriceId: subscription.items.data[0]?.price.id,
        providerStatus: subscription.status,
        status: mapStripeSubscriptionStatus(subscription),
        currentPeriodStart: readUnixTimestamp(subscription, 'current_period_start'),
        currentPeriodEnd: readUnixTimestamp(subscription, 'current_period_end'),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
    }
    catch {
      throw new BillingWebhookVerificationError();
    }
  }
}

// ---------- Private helpers ----------

function findPlusSubscriptionItem(
  subscription: Stripe.Subscription,
  priceId: string,
): Stripe.SubscriptionItem {
  const subscriptionItem =
    subscription.items.data.find((item) => item.price.id === priceId) ??
    subscription.items.data[0];

  if (!subscriptionItem) {
    throw new Error(`Stripe subscription ${subscription.id} has no subscription items.`);
  }

  return subscriptionItem;
}

function isStripeSubscription(value: unknown): value is Stripe.Subscription {
  return (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && 'object' in value
    && (value as { object?: unknown }).object === 'subscription'
  );
}

function mapStripeSubscriptionStatus(
  subscription: Stripe.Subscription,
): SubscriptionStatus {
  if (subscription.cancel_at_period_end) {
    return SubscriptionStatus.CANCELING;
  }

  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return SubscriptionStatus.ACTIVE;
  }

  if (
    subscription.status === 'past_due'
    || subscription.status === 'unpaid'
    || subscription.status === 'incomplete'
  ) {
    return SubscriptionStatus.PAST_DUE;
  }

  return SubscriptionStatus.FREE;
}

function readMetadataValue(
  metadata: Stripe.Metadata | null | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];

  return value && value.trim().length > 0 ? value : undefined;
}

function readStripeIdentifier(value: string | { id?: string } | null): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  return value?.id;
}

function readUnixTimestamp(
  subscription: Stripe.Subscription,
  key: 'current_period_start' | 'current_period_end',
): Date | undefined {
  const value = subscription[key] as number | undefined;

  return value ? new Date(value * 1000) : undefined;
}

function requireConfig(value: string | null | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required for Stripe subscriptions.`);
  }

  return value;
}
