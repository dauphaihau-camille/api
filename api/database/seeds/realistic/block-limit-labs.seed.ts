import type { EntityManager } from '@mikro-orm/postgresql';
import { WorkspaceRole } from '../../../src/domains/workspace/domain/enums/workspace-role.enum';
import { seedExhaustedAiTrialUsage } from './ai-usage.seed';
import { seedFavoritesAndVisits, seedWorkspacePreferences } from './document-activity.seed';
import { paragraph } from './document-content.seed';
import { upsertDocument } from './documents.seed';
import type { SeedUserSummary } from './realistic-seed.types';
import { buildSeededPublicId, findUsersByEmail } from './shared.seed';
import {
  buildRealisticSubscriptionSeed,
  upsertWorkspace,
  upsertWorkspaceMembers,
  upsertWorkspaceSubscription,
} from './workspaces.seed';

export const BLOCK_LIMIT_LAB_WORKSPACES = [
  {
    slug: 'block-limit-lab',
    name: 'Block Limit Lab',
    description: 'Free collaborative workspace at the 1,000 block limit for upgrade prompt testing.',
    documentTitle: 'Limit Counter',
    blockCount: 1_000,
    limitLabel: 'collaborative Free workspaces cannot create block 1,001.',
  },
  {
    slug: 'over-limit-lab',
    name: 'Over Limit Lab',
    description: 'Free collaborative workspace above the 1,000 block limit to test downgraded over-limit behavior.',
    documentTitle: 'Over Limit Counter',
    blockCount: 1_200,
    limitLabel: 'over-limit Free workspaces keep existing content but cannot create more blocks.',
  },
  {
    slug: 'ai-trial-limit-lab',
    name: 'AI Trial Limit Lab',
    description: 'Free collaborative workspace with exhausted AI trial responses for upgrade prompt testing.',
    documentTitle: 'AI Usage Limit Notes',
    blockCount: 12,
    limitLabel: 'AI trial responses are exhausted; the next assistant response should be denied.',
    exhaustAiTrial: true,
  },
] as const;

function buildBlockLimitLabContent(blockCount: number, limitLabel: string): unknown[] {
  return Array.from({ length: blockCount }, (_unusedValue, index) =>
    paragraph(`Usage block ${index + 1}: ${limitLabel}`));
}

export async function seedBlockLimitLabWorkspace(input: {
  em: EntityManager;
  users: SeedUserSummary[];
  slug: string;
  name: string;
  description: string;
  documentTitle: string;
  blockCount: number;
  limitLabel: string;
  exhaustAiTrial?: boolean;
}): Promise<void> {
  const owner = findUsersByEmail(input.users, ['maya.chen@example.com'])[0];
  const member = findUsersByEmail(input.users, ['jordan.lee@example.com'])[0];

  if (!owner || !member) {
    return;
  }

  const workspace = await upsertWorkspace(
    input.em,
    input.slug,
    input.name,
    input.description,
  );
  const members = [
    { user: owner, role: WorkspaceRole.OWNER },
    { user: member, role: WorkspaceRole.MEMBER },
  ];

  await upsertWorkspaceMembers(input.em, workspace.id, members);
  await upsertWorkspaceSubscription({
    em: input.em,
    workspaceId: workspace.id,
    seatCount: members.length,
    seed: buildRealisticSubscriptionSeed({
      workspaceKey: input.slug,
      workspaceName: workspace.name,
      replicaIndex: 1,
      template: { state: 'free' },
    }),
  });

  const contentJson = buildBlockLimitLabContent(input.blockCount, input.limitLabel);
  const document = await upsertDocument(input.em, {
    key: 'limit-counter',
    publicId: buildSeededPublicId(`${input.slug}:limit-counter`),
    workspaceId: workspace.id,
    title: input.documentTitle,
    contentJson,
    sortKey: 0,
    createdById: owner.id,
    updatedById: owner.id,
  });

  await seedWorkspacePreferences(input.em, workspace.id, [owner, member], [document]);
  await seedFavoritesAndVisits(input.em, workspace.id, [owner, member], [document]);

  if (input.exhaustAiTrial) {
    await seedExhaustedAiTrialUsage({
      em: input.em,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      seatCount: members.length,
    });
  }
}
