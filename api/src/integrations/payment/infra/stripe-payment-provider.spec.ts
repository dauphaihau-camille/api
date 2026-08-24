import type Stripe from 'stripe';
import type { PaymentConfig } from '~/platform/config/payment.config';
import {
  StripePaymentProvider,
  type StripePaymentClient,
} from './stripe-payment-provider';

const paymentConfig: PaymentConfig = {
  driver: 'stripe',
  publicBaseUrl: 'https://app.example',
  stripeSecretKey: 'sk_test_1',
  stripeWebhookSecret: 'whsec_1',
  successPath: '/payments/success',
  cancelPath: '/payments/cancel',
};

describe('StripePaymentProvider', () => {
  function createStripeClient() {
    return {
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: 'cs_1',
            url: 'https://checkout.stripe.test/cs_1',
            expires_at: 1_788_220_800,
          } satisfies Partial<Stripe.Checkout.Session>),
        },
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    } as unknown as StripePaymentClient;
  }

  it('builds same-origin success and cancel URLs for one-time checkout', async () => {
    const stripeClient = createStripeClient();
    const provider = new StripePaymentProvider(paymentConfig, stripeClient);

    const session = await provider.startCheckout({
      orderId: 'order-1',
      customerId: 'customer-1',
      customerEmail: 'buyer@example.com',
      successUrl: 'https://app.example/payments/success?source=billing',
      cancelUrl: '/payments/cancel',
      lineItems: [
        {
          sku: 'sku-1',
          name: 'One-time add-on',
          quantity: 2,
          unitAmount: 1500,
          currency: 'usd',
        },
      ],
      metadata: {
        order_id: 'order-1',
      },
    });

    expect(session).toEqual({
      sessionId: 'cs_1',
      checkoutUrl: 'https://checkout.stripe.test/cs_1',
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cancel_url: 'https://app.example/payments/cancel?order_id=order-1',
        customer_email: 'buyer@example.com',
        mode: 'payment',
        success_url:
          'https://app.example/payments/success?source=billing&order_id=order-1&checkout_session_id={CHECKOUT_SESSION_ID}',
      }),
    );
  });

  it('rejects checkout redirects from another origin', async () => {
    const provider = new StripePaymentProvider(
      paymentConfig,
      createStripeClient(),
    );

    await expect(provider.startCheckout({
      orderId: 'order-1',
      customerId: 'customer-1',
      customerEmail: 'buyer@example.com',
      successUrl: 'https://attacker.example/payments/success',
      cancelUrl: '/payments/cancel',
      lineItems: [
        {
          sku: 'sku-1',
          name: 'One-time add-on',
          quantity: 1,
          unitAmount: 1500,
          currency: 'usd',
        },
      ],
    })).rejects.toThrow('Stripe checkout redirect URL is invalid.');
  });
});
