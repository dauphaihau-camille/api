import {
  buildRealisticLeafContent,
  buildRealisticParentContent,
  buildRealisticSubscriptionSeed,
} from './realistic.seed';
import { SubscriptionPlan } from '../../src/domains/subscription/domain/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../src/domains/subscription/domain/enums/subscription-status.enum';

describe('realistic seed content builders', () => {
  it('builds realistic leaf content with headings and paragraphs', () => {
    const content = buildRealisticLeafContent({
      title: 'Search Quality Spec',
      summary: 'Scope and rollout plan for AI search.',
      kind: 'spec',
    });

    expect(content).toEqual([
      {
        type: 'heading',
        props: { level: 2 },
        content: [{ type: 'text', text: 'Search Quality Spec' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Scope and rollout plan for AI search.' }],
      },
      {
        type: 'heading',
        props: { level: 3 },
        content: [{ type: 'text', text: 'Objective' }],
      },
      expect.objectContaining({
        type: 'paragraph',
      }),
      {
        type: 'heading',
        props: { level: 3 },
        content: [{ type: 'text', text: 'Current Signal' }],
      },
      expect.objectContaining({
        type: 'paragraph',
      }),
      {
        type: 'heading',
        props: { level: 3 },
        content: [{ type: 'text', text: 'Decision Needed' }],
      },
      expect.objectContaining({
        type: 'paragraph',
      }),
      {
        type: 'heading',
        props: { level: 3 },
        content: [{ type: 'text', text: 'Next Actions' }],
      },
      expect.objectContaining({
        type: 'paragraph',
      }),
    ]);
  });

  it('appends subdoc blocks for child documents', () => {
    const content = buildRealisticParentContent({
      title: 'Engineering Hub',
      summary: 'Shared engineering entry point.',
      kind: 'hub',
      childDocuments: [
        {
          key: 'release-runbook',
          id: 'child-1',
          publicId: 'abcdefabcdefabcdefabcdefabcdefab',
          title: 'Release Runbook',
          workspaceId: 'workspace-1',
        },
      ],
    });

    expect(content.at(-1)).toMatchObject({
      type: 'subdoc',
      props: {
        documentId: 'child-1',
        publicId: 'abcdefabcdefabcdefabcdefabcdefab',
        workspaceId: 'workspace-1',
        title: 'Release Runbook',
      },
      children: [],
    });
  });

  it('builds deterministic Stripe-shaped Plus subscription demo data', () => {
    const seed = buildRealisticSubscriptionSeed({
      workspaceKey: 'acme-product',
      workspaceName: 'Camille AI',
      replicaIndex: 1,
      template: {
        state: 'plus_active',
      },
    });

    expect(seed).toMatchObject({
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
      provider: 'stripe',
      providerPriceId: 'price_demo_plus_monthly',
      providerStatus: 'active',
    });
    expect(seed.providerCustomerId).toMatch(/^cus_demo_/);
    expect(seed.providerSubscriptionId).toMatch(/^sub_demo_/);
  });

  it('uses replica subscription states for cancellation and past-due demos', () => {
    expect(buildRealisticSubscriptionSeed({
      workspaceKey: 'acme-product',
      workspaceName: 'Camille AI 2',
      replicaIndex: 2,
      template: {
        state: 'plus_active',
        replicaStates: {
          2: 'plus_canceling',
        },
      },
    })).toMatchObject({
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.CANCELING,
      cancelAtPeriodEnd: true,
      providerStatus: 'active',
    });

    expect(buildRealisticSubscriptionSeed({
      workspaceKey: 'northwind-ops',
      workspaceName: 'Northstar GTM AI 2',
      replicaIndex: 2,
      template: {
        state: 'free',
        replicaStates: {
          2: 'plus_past_due',
        },
      },
    })).toMatchObject({
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.PAST_DUE,
      cancelAtPeriodEnd: false,
      providerStatus: 'past_due',
    });
  });
});
