import {
  buildRealisticLeafContent,
  buildRealisticParentContent,
} from './realistic/document-content.seed';
import { buildRealisticSubscriptionSeed } from './realistic/workspaces.seed';
import {
  buildMarkdownDocumentContent,
  parseMarkdownSeedFileContent,
} from './realistic/markdown-documents.seed';
import { SubscriptionPlan } from '../../src/domains/subscription/domain/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../src/domains/subscription/domain/enums/subscription-status.enum';

describe('realistic seed content builders', () => {
  it('builds realistic leaf content with headings and paragraphs', () => {
    const content = buildRealisticLeafContent({
      summary: 'Scope and rollout plan for AI search.',
      kind: 'spec',
    });

    expect(content).toEqual([
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

  it('parses markdown seed metadata and nested document paths', () => {
    const file = parseMarkdownSeedFileContent({
      relativePath: 'ai-product-lab/AI Launch Plan/Evaluation Checklist.md',
      markdown: [
        '---',
        'workspace: ai-product-lab',
        'title: Launch Evaluation',
        'ownerEmail: maya.chen@example.com',
        'teamspace: Product',
        'sortKey: 20',
        '---',
        '',
        '# Evaluation Checklist',
        '',
        '- Run golden set',
      ].join('\n'),
    });

    expect(file).toMatchObject({
      documentKey: 'AI Launch Plan/Evaluation Checklist',
      parentKey: 'AI Launch Plan',
      title: 'Launch Evaluation',
      workspaceSlug: 'ai-product-lab',
      metadata: {
        ownerEmail: 'maya.chen@example.com',
        teamspace: 'Product',
        sortKey: 20,
      },
    });
    expect(file.content).toEqual([
      {
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'Evaluation Checklist' }],
      },
      {
        type: 'bulletListItem',
        content: [{ type: 'text', text: 'Run golden set' }],
      },
    ]);
  });

  it('conservatively flattens markdown blocks that are not nested documents', () => {
    const content = buildMarkdownDocumentContent([
      '## API Contract',
      '',
      '| Field | Value |',
      '| --- | --- |',
      '| Status | Ready |',
      '',
      '![Diagram](./diagram.png)',
      '',
      '```ts',
      'const enabled = true;',
      '```',
    ].join('\n'));

    expect(content).toEqual([
      {
        type: 'heading',
        props: { level: 2 },
        content: [{ type: 'text', text: 'API Contract' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Field | Value --- | --- Status | Ready' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Image: Diagram (./diagram.png)' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'const enabled = true;' }],
      },
    ]);
  });

  it('preserves unordered and ordered markdown list block types', () => {
    const content = buildMarkdownDocumentContent([
      'You are no longer the person who writes the code. You are the person who:',
      '',
      '- Defines what gets built and why',
      '- Designs the architecture the agent works within',
      '- Reviews what the agent produces',
      '- Decides what ships and what doesn’t',
      '',
      '1. Write a spec before every agent task',
      '2. Read every diff',
      '3. Run the tests before calling anything done',
    ].join('\n'));

    expect(content).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'You are no longer the person who writes the code. You are the person who:' }],
      },
      {
        type: 'bulletListItem',
        content: [{ type: 'text', text: 'Defines what gets built and why' }],
      },
      {
        type: 'bulletListItem',
        content: [{ type: 'text', text: 'Designs the architecture the agent works within' }],
      },
      {
        type: 'bulletListItem',
        content: [{ type: 'text', text: 'Reviews what the agent produces' }],
      },
      {
        type: 'bulletListItem',
        content: [{ type: 'text', text: 'Decides what ships and what doesn’t' }],
      },
      {
        type: 'numberedListItem',
        content: [{ type: 'text', text: 'Write a spec before every agent task' }],
      },
      {
        type: 'numberedListItem',
        content: [{ type: 'text', text: 'Read every diff' }],
      },
      {
        type: 'numberedListItem',
        content: [{ type: 'text', text: 'Run the tests before calling anything done' }],
      },
    ]);
  });

  it('parses bold inline markdown in paragraphs and lists', () => {
    const content = buildMarkdownDocumentContent([
      '**Scoped. Constrained. Reviewable.**',
      '',
      '1. Read every diff Not skim. Read. **If the agent changed 200 lines, you read 200 lines**.',
    ].join('\n'));

    expect(content).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Scoped. Constrained. Reviewable.', styles: { bold: true } }],
      },
      {
        type: 'numberedListItem',
        content: [
          { type: 'text', text: 'Read every diff Not skim. Read. ' },
          { type: 'text', text: 'If the agent changed 200 lines, you read 200 lines', styles: { bold: true } },
          { type: 'text', text: '.' },
        ],
      },
    ]);
  });
});
