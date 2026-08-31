import type { EntityManager } from '@mikro-orm/postgresql';
import { WorkspaceRole } from '../../src/domains/workspace/domain/enums/workspace-role.enum';
import { REALISTIC_WORKSPACE_TEMPLATES } from './fixtures/realistic.fixtures';
import type { WorkspaceTemplate } from './fixtures/realistic.types';
import { seedAiConversationSessions } from './realistic/ai-chat.seed';
import { seedConsumedAiResponses } from './realistic/ai-usage.seed';
import {
  BLOCK_LIMIT_LAB_WORKSPACES,
  seedBlockLimitLabWorkspace,
} from './realistic/block-limit-labs.seed';
import {
  seedDocumentAccessGrants,
  seedDocumentAccessSettings,
} from './realistic/document-access.seed';
import {
  seedFavoritesAndVisits,
  seedPublishedDocs,
  seedSubdocReferences,
  seedWorkspacePreferences,
} from './realistic/document-activity.seed';
import {
  seedDocumentTree,
  seedMemberPersonalDocuments,
} from './realistic/documents.seed';
import { seedMarkdownDocuments } from './realistic/markdown-documents.seed';
import type {
  RealisticSeedConfig,
  SeedDocumentSummary,
  SeedUserSummary,
} from './realistic/realistic-seed.types';
import {
  findUsersByEmail,
  formatDuration,
  resolvePositiveInteger,
  selectExtraMembers,
} from './realistic/shared.seed';
import { upsertTeamspaceMembers, upsertTeamspaces } from './realistic/teamspaces.seed';
import { seedRealisticUsers } from './realistic/users.seed';
import {
  buildRealisticSubscriptionSeed,
  upsertWorkspace,
  upsertWorkspaceMembers,
  upsertWorkspaceSubscription,
} from './realistic/workspaces.seed';

type RealisticSeedState = {
  users: SeedUserSummary[];
  config: RealisticSeedConfig;
};

function resolveRealisticSeedConfig(env: NodeJS.ProcessEnv): RealisticSeedConfig {
  return {
    workspaceReplicas: resolvePositiveInteger(env, 'SEED_REALISTIC_WORKSPACE_REPLICAS', 2, 1),
    extraMembersPerWorkspace: resolvePositiveInteger(env, 'SEED_REALISTIC_EXTRA_MEMBERS_PER_WORKSPACE', 4, 0),
    password: env.SEED_REALISTIC_DEFAULT_PASSWORD?.trim() || 'password123',
  };
}

async function seedWorkspaceScenario(
  em: EntityManager,
  state: RealisticSeedState,
  template: WorkspaceTemplate,
  replicaIndex: number,
): Promise<void> {
  const replicaKey = `${template.key}-${replicaIndex}`;
  const workspaceName = replicaIndex === 1 ? template.name : `${template.name} ${replicaIndex}`;
  const workspaceSlug = replicaIndex === 1 ? template.key : `${template.key}-${replicaIndex}`;
  const workspaceDescription = `${template.description} Replica ${replicaIndex}.`;
  const workspace = await upsertWorkspace(em, workspaceSlug, workspaceName, workspaceDescription);
  const baseMembers = template.members.flatMap((member) => {
    const user = findUsersByEmail(state.users, [member.email])[0];

    return user
      ? [{ user, role: member.role }]
      : [];
  });
  const takenUserIds = new Set(baseMembers.map((member) => member.user.id));
  const extraMembers = selectExtraMembers(state.users, takenUserIds, state.config.extraMembersPerWorkspace);
  const memberUsers = [
    ...baseMembers,
    ...extraMembers.map((user) => ({ user, role: WorkspaceRole.MEMBER })),
  ];

  await upsertWorkspaceMembers(em, workspace.id, memberUsers);
  await upsertWorkspaceSubscription({
    em,
    workspaceId: workspace.id,
    seatCount: memberUsers.length,
    seed: buildRealisticSubscriptionSeed({
      workspaceKey: template.key,
      workspaceName,
      replicaIndex,
      template: template.subscription,
    }),
  });

  const memberSummaries = memberUsers.map((member) => member.user);
  const teamspacesByKey = await upsertTeamspaces(em, workspace.id, template.teamspaces);
  await upsertTeamspaceMembers(
    em,
    memberSummaries,
    teamspacesByKey,
    template.teamspaces,
  );

  const documents: SeedDocumentSummary[] = [];

  for (const [index, rootDocument] of template.documents.entries()) {
    documents.push(
      ...(await seedDocumentTree(
        em,
        workspace.id,
        teamspacesByKey,
        memberSummaries,
        rootDocument,
        replicaKey,
        index,
      )),
    );
  }

  documents.push(
    ...(await seedMemberPersonalDocuments({
      em,
      workspaceId: workspace.id,
      memberUsers: memberSummaries,
      replicaKey,
      startingSortKey: template.documents.length + 100,
    })),
  );
  const { countedResponses } = await seedAiConversationSessions({
    em,
    workspaceId: workspace.id,
    templateKey: template.key,
    memberUsers: memberSummaries,
    documents,
  });
  await seedConsumedAiResponses({
    em,
    workspaceId: workspace.id,
    workspaceName,
    consumedResponses: countedResponses,
  });

  await seedWorkspacePreferences(em, workspace.id, memberSummaries, documents);
  await seedDocumentAccessGrants(
    em,
    workspace.id,
    memberSummaries,
    documents,
    template.documentAccessGrants,
  );
  await seedDocumentAccessSettings(
    em,
    workspace.id,
    memberSummaries,
    documents,
    template.documentAccessSettings,
  );
  await seedFavoritesAndVisits(em, workspace.id, memberSummaries, documents);
  await seedPublishedDocs(em, workspace.id, memberSummaries, documents);
  await seedSubdocReferences(em, workspace.id, documents);
}

export async function seedRealisticData(em: EntityManager): Promise<void> {
  const startedAt = Date.now();
  const config = resolveRealisticSeedConfig(process.env);
  const users = await seedRealisticUsers(em, config.password);

  console.log(`[seed][realistic] Seeding realistic workspaces with config ${JSON.stringify(config)}`);

  for (let replicaIndex = 1; replicaIndex <= config.workspaceReplicas; replicaIndex += 1) {
    for (const template of REALISTIC_WORKSPACE_TEMPLATES) {
      const workspaceStartedAt = Date.now();
      await seedWorkspaceScenario(em, { users, config }, template, replicaIndex);
      console.log(
        `[seed][realistic] Seeded ${template.key} replica ${replicaIndex} in ${formatDuration(Date.now() - workspaceStartedAt)}`,
      );
    }
  }

  for (const labWorkspace of BLOCK_LIMIT_LAB_WORKSPACES) {
    await seedBlockLimitLabWorkspace({
      em,
      users,
      ...labWorkspace,
    });
  }

  const markdownDocuments = await seedMarkdownDocuments({ em, users });
  if (markdownDocuments.length > 0) {
    console.log(`[seed][realistic] Seeded ${markdownDocuments.length} markdown documents`);
  }

  console.log(`[seed][realistic] Total duration: ${formatDuration(Date.now() - startedAt)}`);
}
