import type Stripe from 'stripe';
import type { PaymentConfig } from '~/platform/config/payment.config';
import { SubscriptionInvalidReturnUrlError } from '~/domains/subscription/app/errors/subscription-app.error';
import { SubscriptionStatus } from '~/domains/subscription/domain/enums/subscription-status.enum';
import {
  StripeSubscriptionBillingProvider,
  type StripeBillingClient,
} from './stripe-subscription-billing-provider';

const paymentConfig: PaymentConfig = {
  driver: 'stripe',
  publicBaseUrl: 'https://app.example',
  stripeSecretKey: 'sk_test_1',
  stripeWebhookSecret: 'whsec_1',
  stripePlusPriceId: 'price_plus',
  successPath: '/payments/success',
  cancelPath: '/payments/cancel',
};

describe('StripeSubscriptionBillingProvider', () => {
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
      subscriptionItems: {
        update: jest.fn().mockResolvedValue({ id: 'si_1' }),
      },
      subscriptions: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'sub_1',
          items: {
            data: [
              {
                id: 'si_1',
                price: { id: 'price_plus' },
              },
            ],
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'sub_1' }),
      },
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          id: 'evt_1',
          type: 'customer.subscription.updated',
          created: 1_788_134_400,
          data: {
            object: {
              object: 'subscription',
              id: 'sub_1',
              status: 'active',
              cancel_at_period_end: false,
              customer: 'cus_1',
              metadata: {
                workspace_id: 'workspace-1',
              },
              items: {
                data: [
                  {
                    id: 'si_1',
                    price: { id: 'price_plus' },
                  },
                ],
              },
              current_period_start: 1_788_134_400,
              current_period_end: 1_790_812_800,
            },
          },
        } as unknown as Stripe.Event),
      },
    } as unknown as StripeBillingClient;
  }

  it('starts Plus checkout as a Stripe subscription session', async () => {
    const stripeClient = createStripeClient();
    const provider = new StripeSubscriptionBillingProvider(
      paymentConfig,
      stripeClient,
    );

    const session = await provider.startPlusCheckout({
      workspaceId: 'workspace-1',
      workspaceName: 'Workspace 1',
      customerEmail: 'owner@example.com',
      seatCount: 3,
      returnUrl: 'https://app.example/w/workspace-1/settings/billing?from=settings',
    });

    expect(session).toEqual({
      sessionId: 'cs_1',
      checkoutUrl: 'https://checkout.stripe.test/cs_1',
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: 'owner@example.com',
        line_items: [
          {
            price: 'price_plus',
            quantity: 3,
          },
        ],
        mode: 'subscription',
        cancel_url:
          'https://app.example/w/workspace-1/settings/billing?from=settings&checkout=cancelled&workspace_id=workspace-1',
        subscription_data: {
          metadata: {
            workspace_id: 'workspace-1',
          },
        },
        success_url:
          'https://app.example/w/workspace-1/settings/billing?from=settings&checkout=success&workspace_id=workspace-1&checkout_session_id={CHECKOUT_SESSION_ID}',
      }),
    );
  });

  it('rejects checkout return URLs from a different origin', async () => {
    const provider = new StripeSubscriptionBillingProvider(
      paymentConfig,
      createStripeClient(),
    );

    await expect(provider.startPlusCheckout({
      workspaceId: 'workspace-1',
      workspaceName: 'Workspace 1',
      customerEmail: 'owner@example.com',
      seatCount: 3,
      returnUrl: 'https://attacker.example/w/workspace-1/settings/billing',
    })).rejects.toBeInstanceOf(SubscriptionInvalidReturnUrlError);
  });

  it('maps verified Stripe subscription webhooks to billing events', async () => {
    const stripeClient = createStripeClient();
    const provider = new StripeSubscriptionBillingProvider(
      paymentConfig,
      stripeClient,
    );

    const event = await provider.verifyWebhook({
      signature: 'sig_1',
      rawBody: '{"id":"evt_1"}',
    });

    expect(stripeClient.webhooks.constructEvent).toHaveBeenCalledWith(
      '{"id":"evt_1"}',
      'sig_1',
      'whsec_1',
    );
    expect(event).toEqual({
      eventId: 'evt_1',
      eventType: 'customer.subscription.updated',
      provider: 'stripe',
      workspaceId: 'workspace-1',
      providerCustomerId: 'cus_1',
      providerSubscriptionId: 'sub_1',
      providerPriceId: 'price_plus',
      providerStatus: 'active',
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date('2026-08-31T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
    });
  });

  it('updates the Plus subscription item quantity for seat sync', async () => {
    const stripeClient = createStripeClient();
    const provider = new StripeSubscriptionBillingProvider(
      paymentConfig,
      stripeClient,
    );

    await provider.updateSubscriptionQuantity({
      providerSubscriptionId: 'sub_1',
      quantity: 4,
    });

    expect(stripeClient.subscriptions.retrieve).toHaveBeenCalledWith(
      'sub_1',
      { expand: ['items.data.price'] },
    );
    expect(stripeClient.subscriptionItems.update).toHaveBeenCalledWith('si_1', {
      quantity: 4,
    });
  });
});
