import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import type { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import { WorkspaceRole } from '~/domains/workspace/domain/enums/workspace-role.enum';
import { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../domain/enums/subscription-status.enum';
import type { BillingProvider } from '../ports/billing-provider';
import type { SubscriptionRepository } from '../ports/subscription.repository';
import { BlockCreationGateService } from '../services/block-creation-gate.service';
import { SeatSyncService } from '../services/seat-sync.service';
import { SubscriptionEntitlementService } from '../services/subscription-entitlement.service';
import { SubscriptionSummaryService } from '../services/subscription-summary.service';
import { WorkspaceBlockLimitReachedError } from '../errors/subscription-app.error';
import { CreateCheckoutSessionUseCase } from './create-checkout-session.use-case';
import { GetSubscriptionSummaryUseCase } from './get-subscription-summary.use-case';
import { HandleBillingWebhookUseCase } from './handle-billing-webhook.use-case';

describe('Subscription use cases', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'owner@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  function createWorkspaceRepository(role = WorkspaceRole.OWNER) {
    return {
      findAllForUser: jest.fn().mockResolvedValue([
        {
          id: 'workspace-1',
          version: 1,
          slug: 'workspace-1',
          name: 'Workspace 1',
          description: undefined,
          currentUserRole: role,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    } as unknown as jest.Mocked<WorkspaceRepository>;
  }

  function createSubscriptionRepository() {
    return {
      findByWorkspaceId: jest.fn(),
      findByProviderSubscriptionId: jest.fn(),
      getOrCreateFreeSubscription: jest.fn().mockResolvedValue({
        id: 'subscription-1',
        version: 1,
        workspaceId: 'workspace-1',
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.FREE,
        seatCount: 2,
        cancelAtPeriodEnd: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      countBillableMembers: jest.fn().mockResolvedValue(2),
      countWorkspaceBlocks: jest.fn().mockResolvedValue(25),
      updateSubscription: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionRepository>;
  }

  function createBillingProvider() {
    return {
      startPlusCheckout: jest.fn().mockResolvedValue({
        sessionId: 'checkout-1',
        checkoutUrl: 'https://billing.example/checkout-1',
      }),
      updateSubscriptionQuantity: jest.fn(),
      scheduleCancellation: jest.fn(),
      verifyWebhook: jest.fn(),
    } as unknown as jest.Mocked<BillingProvider>;
  }

  it('returns a default Free subscription summary with the collaborative block limit', async () => {
    const subscriptionRepository = createSubscriptionRepository();
    const summaryService = new SubscriptionSummaryService(
      subscriptionRepository,
      new SubscriptionEntitlementService(),
    );
    const useCase = new GetSubscriptionSummaryUseCase(
      createWorkspaceRepository(),
      summaryService,
    );

    const summary = await useCase.execute('workspace-1', currentUser);

    expect(summary).toEqual(expect.objectContaining({
      workspaceId: 'workspace-1',
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.FREE,
      seatCount: 2,
      blockCount: 25,
      blockLimit: 1000,
      entitlements: { maxBlocks: 1000 },
    }));
  });

  it('keeps solo Free workspaces unlimited', async () => {
    const entitlementService = new SubscriptionEntitlementService();

    expect(entitlementService.resolveEntitlements({
      plan: SubscriptionPlan.FREE,
      seatCount: 1,
    })).toEqual({ maxBlocks: null });
  });

  it('keeps Business workspaces unlimited', async () => {
    const entitlementService = new SubscriptionEntitlementService();

    expect(entitlementService.resolveEntitlements({
      plan: SubscriptionPlan.BUSINESS,
      seatCount: 25,
    })).toEqual({ maxBlocks: null });
  });

  it('blocks creating content when a collaborative Free workspace would exceed its block limit', async () => {
    const subscriptionRepository = createSubscriptionRepository();
    subscriptionRepository.countWorkspaceBlocks.mockResolvedValue(1000);
    const gate = new BlockCreationGateService(
      new SubscriptionSummaryService(
        subscriptionRepository,
        new SubscriptionEntitlementService(),
      ),
    );

    await expect(gate.assertCanCreateBlocks({
      workspaceId: 'workspace-1',
      newBlockCount: 1,
    })).rejects.toBeInstanceOf(WorkspaceBlockLimitReachedError);
  });

  it('starts Plus checkout with the current seat count', async () => {
    const subscriptionRepository = createSubscriptionRepository();
    const billingProvider = createBillingProvider();
    const useCase = new CreateCheckoutSessionUseCase(
      createWorkspaceRepository(),
      subscriptionRepository,
      billingProvider,
    );

    await useCase.execute('workspace-1', currentUser, {
      returnUrl: 'http://localhost:5102/w/workspace-1/settings/billing',
    });

    expect(subscriptionRepository.getOrCreateFreeSubscription).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      seatCount: 2,
    });
    expect(billingProvider.startPlusCheckout).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      workspaceName: 'Workspace 1',
      customerEmail: 'owner@example.com',
      seatCount: 2,
      returnUrl: 'http://localhost:5102/w/workspace-1/settings/billing',
    });
  });

  it('syncs provider quantity for paid workspaces when seat count changes', async () => {
    const subscriptionRepository = createSubscriptionRepository();
    const billingProvider = createBillingProvider();
    subscriptionRepository.findByWorkspaceId.mockResolvedValue({
      id: 'subscription-1',
      version: 1,
      workspaceId: 'workspace-1',
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE,
      seatCount: 2,
      cancelAtPeriodEnd: false,
      providerSubscriptionId: 'stripe-sub-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    subscriptionRepository.countBillableMembers.mockResolvedValue(3);

    await new SeatSyncService(
      subscriptionRepository,
      billingProvider,
    ).syncWorkspaceSeats('workspace-1');

    expect(subscriptionRepository.updateSubscription).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      seatCount: 3,
    });
    expect(billingProvider.updateSubscriptionQuantity).toHaveBeenCalledWith({
      providerSubscriptionId: 'stripe-sub-1',
      quantity: 3,
    });
  });

  it('activates Plus from a verified billing webhook carrying workspace metadata', async () => {
    const subscriptionRepository = createSubscriptionRepository();
    const billingProvider = createBillingProvider();
    subscriptionRepository.findByProviderSubscriptionId.mockResolvedValue(null);
    billingProvider.verifyWebhook.mockResolvedValue({
      eventId: 'evt-1',
      eventType: 'customer.subscription.created',
      provider: 'stripe',
      workspaceId: 'workspace-1',
      providerCustomerId: 'cus-1',
      providerSubscriptionId: 'sub-1',
      providerPriceId: 'price-1',
      providerStatus: 'active',
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
    });

    const result = await new HandleBillingWebhookUseCase(
      subscriptionRepository,
      billingProvider,
    ).execute({
      signature: 'sig',
      rawBody: '{}',
    });

    expect(result.handled).toBe(true);
    expect(subscriptionRepository.updateSubscription).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
      provider: 'stripe',
      providerCustomerId: 'cus-1',
      providerSubscriptionId: 'sub-1',
      providerPriceId: 'price-1',
      providerStatus: 'active',
    });
  });
});
