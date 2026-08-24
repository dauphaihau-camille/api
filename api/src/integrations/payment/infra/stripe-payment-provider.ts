import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import type { PaymentConfig } from '~/platform/config/payment.config';
import { PaymentProvider } from '../app/ports/payment-provider';
import type {
  CheckoutSession,
  StartCheckoutInput,
  VerifiedPaymentWebhook,
} from '../app/payment.types';
import { buildStripeCheckoutRedirectUrl } from './stripe-checkout-redirect-url';

export type StripePaymentClient = {
  checkout: {
    sessions: {
      create(params: Stripe.Checkout.SessionCreateParams): Promise<Stripe.Checkout.Session>;
    };
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
export class StripePaymentProvider implements PaymentProvider {
  private readonly stripe: StripePaymentClient;

  constructor(
    private readonly paymentConfig: PaymentConfig,
    stripeClient?: StripePaymentClient,
  ) {
    this.stripe = stripeClient ?? new Stripe(
      requireConfig(paymentConfig.stripeSecretKey, 'STRIPE_SECRET_KEY'),
      {
        maxNetworkRetries: 2,
        timeout: 10_000,
      },
    );
  }

  async startCheckout(input: StartCheckoutInput): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: input.customerEmail,
      line_items: input.lineItems.map((lineItem) => ({
        price_data: {
          currency: lineItem.currency,
          product_data: {
            name: lineItem.name,
          },
          unit_amount: lineItem.unitAmount,
        },
        quantity: lineItem.quantity,
      })),
      metadata: input.metadata,
      success_url: buildStripeCheckoutRedirectUrl({
        paymentConfig: this.paymentConfig,
        pathOrUrl: input.successUrl,
        query: {
          order_id: input.orderId,
          checkout_session_id: '{CHECKOUT_SESSION_ID}',
        },
      }),
      cancel_url: buildStripeCheckoutRedirectUrl({
        paymentConfig: this.paymentConfig,
        pathOrUrl: input.cancelUrl,
        query: {
          order_id: input.orderId,
        },
      }),
    });

    return {
      sessionId: session.id,
      checkoutUrl: requireConfig(session.url, 'Stripe checkout session URL'),
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  async verifyWebhook(input: {
    signature?: string;
    rawBody: Buffer | string;
  }): Promise<VerifiedPaymentWebhook> {
    const event = this.stripe.webhooks.constructEvent(
      input.rawBody,
      requireConfig(input.signature, 'stripe-signature'),
      requireConfig(this.paymentConfig.stripeWebhookSecret, 'STRIPE_WEBHOOK_SECRET'),
    );

    return {
      eventId: event.id,
      eventType: event.type,
      occurredAt: new Date(event.created * 1000),
      payload: event.data.object as unknown as Record<string, unknown>,
    };
  }
}

function requireConfig(value: string | null | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required for Stripe payments.`);
  }

  return value;
}
