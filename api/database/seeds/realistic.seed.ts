import type { EntityManager } from '@mikro-orm/postgresql';
import { createHash } from 'node:crypto';
import { buildAuthConfig } from '../../src/platform/config/auth.config';
import { UserStatus } from '../../src/domains/auth/domain/enums/user-status.enum';
import { CurrentUserCredentialEntity } from '../../src/domains/auth/infra/persistence/entities/current-user-credential.entity';
import { CurrentUserEntity } from '../../src/domains/auth/infra/persistence/entities/current-user.entity';
import { UserRoleEntity } from '../../src/domains/auth/infra/persistence/entities/user-role.entity';
import { BcryptPasswordHasher } from '../../src/domains/auth/infra/security/bcrypt-password-hasher';
import { DEFAULT_CONTENT_FORMAT } from '../../src/domains/document/app/constants/document.constants';
import { extractDocumentSearchText } from '../../src/domains/document/app/utils/document-search-text.util';
import { DocumentAccessGrantPermission } from '../../src/domains/document/domain/enums/document-access-grant-permission.enum';
import { DocumentAccessGrantEntity } from '../../src/domains/document/infra/persistence/entities/document-access-grant.entity';
import { DocumentAccessSettingEntity } from '../../src/domains/document/infra/persistence/entities/document-access-setting.entity';
import { DocumentEntity } from '../../src/domains/document/infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from '../../src/domains/document/infra/persistence/entities/document-subdoc-reference.entity';
import { DocumentVisitEntity } from '../../src/domains/document/infra/persistence/entities/document-visit.entity';
import { DocumentFavoriteEntity } from '../../src/domains/favorite/infra/persistence/entities/document-favorite.entity';
import { PublishedDocumentEntity } from '../../src/domains/publish/infra/persistence/entities/published-document.entity';
import { SubscriptionPlan } from '../../src/domains/subscription/domain/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../src/domains/subscription/domain/enums/subscription-status.enum';
import { WorkspaceSubscriptionEntity } from '../../src/domains/subscription/infra/persistence/entities/workspace-subscription.entity';
import { TeamspaceAccessMode } from '../../src/domains/teamspace/domain/enums/teamspace-access-mode.enum';
import { TeamspaceMemberEntity } from '../../src/domains/teamspace/infra/persistence/entities/teamspace-member.entity';
import { TeamspaceEntity } from '../../src/domains/teamspace/infra/persistence/entities/teamspace.entity';
import { WorkspaceRole } from '../../src/domains/workspace/domain/enums/workspace-role.enum';
import { WorkspaceEntity } from '../../src/domains/workspace/infra/persistence/entities/workspace.entity';
import { WorkspaceMemberEntity } from '../../src/domains/workspace/infra/persistence/entities/workspace-member.entity';
import { WorkspacePreferenceEntity } from '../../src/domains/workspace-preference/infra/persistence/entities/workspace-preference.entity';
import { seedAuth, seedAuthReferenceData } from './auth.seed';
import {
  REALISTIC_USER_FIXTURES,
  REALISTIC_WORKSPACE_TEMPLATES,
} from './fixtures/realistic.fixtures';
import type {
  DocumentAccessGrantTemplate,
  DocumentAccessSettingTemplate,
  DocumentBlueprint,
  TeamspaceTemplate,
  WorkspaceSubscriptionSeedState,
  WorkspaceSubscriptionTemplate,
  WorkspaceTemplate,
} from './fixtures/realistic.types';

type RealisticSeedConfig = {
  workspaceReplicas: number;
  extraMembersPerWorkspace: number;
  password: string;
};

type SeedUserSummary = {
  id: string;
  email: string;
  displayName: string;
};

type SeedDocumentSummary = {
  key: string;
  id: string;
  publicId: string;
  title: string;
  workspaceId: string;
  parentId?: string;
  teamspaceId?: string;
};

type DocumentPayload = {
  key: string;
  publicId: string;
  workspaceId: string;
  teamspaceId?: string;
  parentDocumentId?: string;
  title: string;
  contentJson: unknown[];
  sortKey: number;
  createdById: string;
  updatedById: string;
};

type WorkspaceSubscriptionSeed = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  provider?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerPriceId?: string;
  providerStatus?: string;
};

type RealisticSeedState = {
  users: SeedUserSummary[];
  config: RealisticSeedConfig;
};

type TextBlock = {
  type: 'paragraph' | 'heading';
  props?: Record<string, unknown>;
  content: Array<{ type: 'text'; text: string }>;
};

function formatDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }

  return `${(ms / 1_000).toFixed(1)}s`;
}

function resolvePositiveInteger(env: NodeJS.ProcessEnv, key: string, fallback: number, minimum = 0): number {
  const value = env[key];

  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${key} must be an integer >= ${minimum}`);
  }

  return parsed;
}

function resolveSeedBcryptSaltRounds(defaultRounds: number): number {
  const configuredRounds = Number(process.env.SEED_BCRYPT_SALT_ROUNDS ?? '4');

  if (Number.isFinite(configuredRounds) && configuredRounds > 0) {
    return configuredRounds;
  }

  return Math.min(defaultRounds, 4);
}

function buildSeededPublicId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

function buildSeededProviderId(prefix: string, seed: string): string {
  return `${prefix}_${createHash('sha256').update(seed).digest('hex').slice(0, 24)}`;
}

function collectPublishedSubtreeDocuments(
  documents: SeedDocumentSummary[],
  rootDocumentIds: string[],
): SeedDocumentSummary[] {
  const targetRootIds = new Set(rootDocumentIds);
  const documentsById = new Map(documents.map((document) => [document.id, document]));

  return documents.filter((document) => {
    let currentDocument: SeedDocumentSummary | undefined = document;

    while (currentDocument) {
      if (targetRootIds.has(currentDocument.id)) {
        return true;
      }

      currentDocument = currentDocument.parentId
        ? documentsById.get(currentDocument.parentId)
        : undefined;
    }

    return false;
  });
}

function resolveRealisticSeedConfig(env: NodeJS.ProcessEnv): RealisticSeedConfig {
  return {
    workspaceReplicas: resolvePositiveInteger(env, 'SEED_REALISTIC_WORKSPACE_REPLICAS', 2, 1),
    extraMembersPerWorkspace: resolvePositiveInteger(env, 'SEED_REALISTIC_EXTRA_MEMBERS_PER_WORKSPACE', 4, 0),
    password: env.SEED_REALISTIC_DEFAULT_PASSWORD?.trim() || 'password123',
  };
}

export function buildRealisticSubscriptionSeed(input: {
  workspaceKey: string;
  workspaceName: string;
  replicaIndex: number;
  template?: WorkspaceSubscriptionTemplate;
}): WorkspaceSubscriptionSeed {
  const state = input.template?.replicaStates?.[input.replicaIndex] ??
    input.template?.state ??
    'free';

  if (state === 'free') {
    return {
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.FREE,
      cancelAtPeriodEnd: false,
    };
  }

  const providerSeed = `${input.workspaceKey}:${input.replicaIndex}`;
  const providerStatusByState: Record<Exclude<WorkspaceSubscriptionSeedState, 'free'>, string> = {
    plus_active: 'active',
    plus_canceling: 'active',
    plus_past_due: 'past_due',
  };
  const statusByState: Record<Exclude<WorkspaceSubscriptionSeedState, 'free'>, SubscriptionStatus> = {
    plus_active: SubscriptionStatus.ACTIVE,
    plus_canceling: SubscriptionStatus.CANCELING,
    plus_past_due: SubscriptionStatus.PAST_DUE,
  };

  return {
    plan: SubscriptionPlan.PLUS,
    status: statusByState[state],
    cancelAtPeriodEnd: state === 'plus_canceling',
    provider: 'stripe',
    providerCustomerId: buildSeededProviderId('cus_seed', providerSeed),
    providerSubscriptionId: buildSeededProviderId('sub_seed', providerSeed),
    providerPriceId: 'price_seed_plus_monthly',
    providerStatus: providerStatusByState[state],
  };
}

function paragraph(text: string): TextBlock {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text }],
  };
}

function heading(text: string, level: 2 | 3 = 2): TextBlock {
  return {
    type: 'heading',
    props: { level },
    content: [{ type: 'text', text }],
  };
}

function buildSubpageBlock(input: {
  documentId: string;
  publicId: string;
  workspaceId: string;
  title: string;
}): unknown {
  return {
    id: buildSeededPublicId(`subdoc:${input.documentId}`),
    type: 'subdoc',
    props: {
      documentId: input.documentId,
      publicId: input.publicId,
      workspaceId: input.workspaceId,
      title: input.title,
    },
    children: [],
  };
}

export function buildRealisticLeafContent(input: {
  title: string;
  summary: string;
  kind: DocumentBlueprint['kind'];
}): unknown[] {
  const focusLineByKind: Record<DocumentBlueprint['kind'], string> = {
    landing: 'Use this page as the quick entry point for AI roadmap, launch, evaluation, and customer signal work.',
    hub: 'This hub groups the working pages that the team opens most often during AI product reviews.',
    spec: 'Capture the problem, scope, user impact, model behavior, permissions, and rollout decisions here.',
    notes: 'Write concise notes, decisions, customer evidence, and open follow-ups after each review.',
    runbook: 'Keep operational steps explicit so another teammate can run the AI workflow without guesswork.',
    roadmap: 'Summarize the quarter priorities, tradeoffs, sequencing, and confidence behind the AI roadmap.',
    wiki: 'Document stable background context that new teammates need before changing prompts, models, or policies.',
    tracker: 'Track ownership, status, confidence, and next actions in a lightweight shared format.',
  };
  const signalLineByKind: Record<DocumentBlueprint['kind'], string> = {
    landing: 'Current signal: search quality, launch readiness, and customer feedback are reviewed twice a week.',
    hub: 'Current signal: the linked pages hold the latest decisions, owners, and unresolved risks.',
    spec: 'Current signal: the team is validating measurable answer quality before broad rollout.',
    notes: 'Current signal: decisions are stable, but follow-up owners should refresh status before the next demo.',
    runbook: 'Current signal: the workflow is ready for staging and needs one final owner pass before production use.',
    roadmap: 'Current signal: Q3 bets are ordered by customer impact, quality confidence, and implementation risk.',
    wiki: 'Current signal: this is shared context for reviewers who need a quick but reliable system overview.',
    tracker: 'Current signal: several items are moving from discovery into launch-readiness review.',
  };
  const actionLineByKind: Record<DocumentBlueprint['kind'], string> = {
    landing: 'Next action: review the linked priority pages and update stale owners before taking screenshots.',
    hub: 'Next action: open each related page, resolve unclear ownership, and archive work that is no longer active.',
    spec: 'Next action: confirm success metrics, acceptance criteria, and the narrowest launch scope.',
    notes: 'Next action: convert unresolved discussion points into tracked owners or explicit decisions.',
    runbook: 'Next action: run the checklist in staging, capture failures, and note the rollback owner.',
    roadmap: 'Next action: verify sequencing against capacity, dependencies, and customer commitments.',
    wiki: 'Next action: keep terminology, examples, and linked decisions current as the AI system changes.',
    tracker: 'Next action: move blocked rows forward by naming the next concrete owner action.',
  };

  return [
    heading(input.title, 2),
    paragraph(input.summary),
    heading('Objective', 3),
    paragraph(focusLineByKind[input.kind]),
    heading('Current Signal', 3),
    paragraph(signalLineByKind[input.kind]),
    heading('Decision Needed', 3),
    paragraph('Decide whether this work is ready for launch review, needs another evaluation pass, or should stay in discovery.'),
    heading('Next Actions', 3),
    paragraph(actionLineByKind[input.kind]),
  ];
}

export function buildRealisticParentContent(input: {
  title: string;
  summary: string;
  kind: DocumentBlueprint['kind'];
  childDocuments: SeedDocumentSummary[];
}): unknown[] {
  return [
    ...buildRealisticLeafContent({
      title: input.title,
      summary: input.summary,
      kind: input.kind,
    }),
    heading('Related Pages', 3),
    ...input.childDocuments.map((childDocument) =>
      buildSubpageBlock({
        documentId: childDocument.id,
        publicId: childDocument.publicId,
        workspaceId: childDocument.workspaceId,
        title: childDocument.title,
      })),
  ];
}

async function seedRealisticUsers(em: EntityManager, password: string): Promise<SeedUserSummary[]> {
  const seededAuth = await seedAuth(em);
  const { roleByKey } = await seedAuthReferenceData(em);
  const memberRole = roleByKey.get('member');
  const adminRole = roleByKey.get('admin');

  if (!memberRole || !adminRole) {
    throw new Error('Realistic seed requires both admin and member auth roles');
  }

  const authConfig = buildAuthConfig({
    get(key: string) {
      return process.env[key];
    },
  });
  const passwordService = new BcryptPasswordHasher({
    ...authConfig,
    bcryptSaltRounds: resolveSeedBcryptSaltRounds(authConfig.bcryptSaltRounds),
  });
  const passwordHash = await passwordService.hash(password);
  const fixtureEmails = REALISTIC_USER_FIXTURES.map((fixture) => fixture.email);
  const existingUsers =
    fixtureEmails.length > 0
      ? await em.find(CurrentUserEntity, { email: { $in: fixtureEmails } }, { populate: ['credential'] })
      : [];
  const existingUsersByEmail = new Map(existingUsers.map((user) => [user.email, user]));
  const existingUserRoles =
    fixtureEmails.length > 0
      ? await em.find(UserRoleEntity, { user: { email: { $in: fixtureEmails } } }, { populate: ['user', 'role'] })
      : [];
  const existingUserRoleKeys = new Set(
    existingUserRoles.map((userRole) => `${userRole.user.email}::${userRole.role.key}`),
  );

  for (const fixture of REALISTIC_USER_FIXTURES) {
    let user = existingUsersByEmail.get(fixture.email);

    if (!user) {
      user = em.create(CurrentUserEntity, {
        email: fixture.email,
        displayName: fixture.displayName,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      });
      existingUsersByEmail.set(fixture.email, user);
    }
    else {
      user.displayName = fixture.displayName;
      user.status = UserStatus.ACTIVE;
      user.emailVerifiedAt = new Date();
    }

    if (!user.credential) {
      user.credential = em.create(CurrentUserCredentialEntity, {
        user,
        passwordHash,
        passwordUpdatedAt: new Date(),
      });
    }
    else {
      user.credential.passwordHash = passwordHash;
      user.credential.passwordUpdatedAt = new Date();
    }

    const role = fixture.role === 'admin' ? adminRole : memberRole;
    const roleKey = `${user.email}::${role.key}`;

    if (!existingUserRoleKeys.has(roleKey)) {
      em.persist(
        em.create(UserRoleEntity, {
          user,
          role,
          assignedAt: new Date(),
        }),
      );
      existingUserRoleKeys.add(roleKey);
    }

    em.persist(user);
  }

  await em.flush();

  return [
    ...Array.from(seededAuth.usersByEmail.values()).map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? user.email,
    })),
    ...REALISTIC_USER_FIXTURES.map((fixture) => {
      const user = existingUsersByEmail.get(fixture.email)!;
      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName ?? user.email,
      };
    }),
  ];
}

function findUsersByEmail(users: SeedUserSummary[], emails: string[]): SeedUserSummary[] {
  const usersByEmail = new Map(users.map((user) => [user.email, user]));

  return emails.flatMap((email) => {
    const user = usersByEmail.get(email);
    return user ? [user] : [];
  });
}

function selectExtraMembers(
  users: SeedUserSummary[],
  takenUserIds: Set<string>,
  count: number,
): SeedUserSummary[] {
  if (count === 0) {
    return [];
  }

  const availableUsers = users.filter((user) => !takenUserIds.has(user.id));
  return availableUsers.slice(0, count);
}

async function upsertWorkspace(
  em: EntityManager,
  slug: string,
  name: string,
  description: string,
): Promise<WorkspaceEntity> {
  const existingWorkspace = await em.findOne(WorkspaceEntity, { slug });
  const workspace = existingWorkspace ??
    em.create(WorkspaceEntity, { slug, name, description });

  workspace.name = name;
  workspace.description = description;
  em.persist(workspace);
  await em.flush();

  return workspace;
}

async function upsertTeamspaces(
  em: EntityManager,
  workspaceId: string,
  templates: TeamspaceTemplate[],
): Promise<Map<string, TeamspaceEntity>> {
  const teamspacesByKey = new Map<string, TeamspaceEntity>();

  for (const template of templates) {
    let teamspace = await em.findOne(TeamspaceEntity, {
      workspace: workspaceId,
      name: template.name,
    });

    if (!teamspace) {
      teamspace = em.create(TeamspaceEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        name: template.name,
        description: template.description,
        accessMode: template.accessMode ?? TeamspaceAccessMode.OPEN,
      });
    }
    else {
      teamspace.description = template.description;
    }

    teamspace.accessMode = template.accessMode ?? TeamspaceAccessMode.OPEN;
    em.persist(teamspace);
    teamspacesByKey.set(template.key, teamspace);
  }

  await em.flush();

  return teamspacesByKey;
}

async function upsertWorkspaceMembers(
  em: EntityManager,
  workspaceId: string,
  members: Array<{ user: SeedUserSummary; role: WorkspaceRole }>,
): Promise<void> {
  const existingMemberships = await em.find(WorkspaceMemberEntity, {
    workspace: workspaceId,
    user: { $in: members.map((member) => member.user.id) },
  }, {
    populate: ['user'],
  });
  const existingByUserId = new Map(existingMemberships.map((membership) => [membership.user.id, membership]));

  for (const member of members) {
    const membership = existingByUserId.get(member.user.id) ??
      em.create(WorkspaceMemberEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        user: em.getReference(CurrentUserEntity, member.user.id),
        role: member.role,
        joinedAt: new Date(),
      });

    membership.role = member.role;
    em.persist(membership);
  }

  await em.flush();
}

async function upsertWorkspaceSubscription(input: {
  em: EntityManager;
  workspaceId: string;
  seatCount: number;
  seed: WorkspaceSubscriptionSeed;
}): Promise<void> {
  const existingSubscription = await input.em.findOne(WorkspaceSubscriptionEntity, {
    workspace: input.workspaceId,
  });
  const subscription = existingSubscription ??
    input.em.create(WorkspaceSubscriptionEntity, {
      workspace: input.em.getReference(WorkspaceEntity, input.workspaceId),
      plan: input.seed.plan,
      status: input.seed.status,
      seatCount: input.seatCount,
      cancelAtPeriodEnd: input.seed.cancelAtPeriodEnd,
    });
  const isPaid = input.seed.plan === SubscriptionPlan.PLUS;

  subscription.workspace = input.em.getReference(WorkspaceEntity, input.workspaceId);
  subscription.plan = input.seed.plan;
  subscription.status = input.seed.status;
  subscription.seatCount = input.seatCount;
  subscription.cancelAtPeriodEnd = input.seed.cancelAtPeriodEnd;
  subscription.currentPeriodStart = isPaid
    ? new Date(Date.UTC(2026, 7, 1, 0, 0, 0))
    : undefined;
  subscription.currentPeriodEnd = isPaid
    ? new Date(Date.UTC(2026, 8, 1, 0, 0, 0))
    : undefined;
  subscription.provider = input.seed.provider;
  subscription.providerCustomerId = input.seed.providerCustomerId;
  subscription.providerSubscriptionId = input.seed.providerSubscriptionId;
  subscription.providerPriceId = input.seed.providerPriceId;
  subscription.providerStatus = input.seed.providerStatus;
  input.em.persist(subscription);
  await input.em.flush();
}

async function upsertTeamspaceMembers(
  em: EntityManager,
  users: SeedUserSummary[],
  teamspacesByKey: Map<string, TeamspaceEntity>,
  templates: TeamspaceTemplate[],
): Promise<void> {
  const usersByEmail = new Map(users.map((user) => [user.email, user]));

  for (const template of templates) {
    const teamspace = teamspacesByKey.get(template.key);

    if (!teamspace || !template.members || template.members.length === 0) {
      continue;
    }

    const memberUserIds = template.members.flatMap((member) => {
      const user = usersByEmail.get(member.email);

      return user ? [user.id] : [];
    });
    const existingMembers = memberUserIds.length > 0
      ? await em.find(TeamspaceMemberEntity, {
        teamspace: teamspace.id,
        user: { $in: memberUserIds },
      }, {
        populate: ['user'],
      })
      : [];
    const existingByUserId = new Map(existingMembers.map((member) => [member.user.id, member]));

    for (const member of template.members) {
      const user = usersByEmail.get(member.email);

      if (!user) {
        continue;
      }

      const existingMember = existingByUserId.get(user.id);
      const teamspaceMember = existingMember ??
        em.create(TeamspaceMemberEntity, {
          teamspace: em.getReference(TeamspaceEntity, teamspace.id),
          user: em.getReference(CurrentUserEntity, user.id),
          role: member.role,
        });

      teamspaceMember.role = member.role;
      em.persist(teamspaceMember);
    }
  }

  await em.flush();
}

async function upsertDocument(
  em: EntityManager,
  payload: DocumentPayload,
): Promise<SeedDocumentSummary> {
  const existingDocument = await em.findOne(DocumentEntity, { publicId: payload.publicId });
  const document = existingDocument ??
    em.create(DocumentEntity, {
      publicId: payload.publicId,
      workspace: em.getReference(WorkspaceEntity, payload.workspaceId),
      title: payload.title,
      contentFormat: DEFAULT_CONTENT_FORMAT,
      contentJson: payload.contentJson,
      searchText: extractDocumentSearchText(payload.contentJson),
      sortKey: payload.sortKey,
      createdBy: em.getReference(CurrentUserEntity, payload.createdById),
      ownerUser: em.getReference(CurrentUserEntity, payload.createdById),
      updatedBy: em.getReference(CurrentUserEntity, payload.updatedById),
    });

  document.workspace = em.getReference(WorkspaceEntity, payload.workspaceId);
  document.teamspace = payload.teamspaceId
    ? em.getReference(TeamspaceEntity, payload.teamspaceId)
    : undefined;
  document.parentDocument = payload.parentDocumentId
    ? em.getReference(DocumentEntity, payload.parentDocumentId)
    : undefined;
  document.title = payload.title;
  document.contentFormat = DEFAULT_CONTENT_FORMAT;
  document.contentJson = payload.contentJson;
  document.searchText = extractDocumentSearchText(payload.contentJson);
  document.sortKey = payload.sortKey;
  document.archivedAt = undefined;
  document.createdBy = em.getReference(CurrentUserEntity, payload.createdById);
  document.ownerUser = em.getReference(CurrentUserEntity, payload.createdById);
  document.updatedBy = em.getReference(CurrentUserEntity, payload.updatedById);
  em.persist(document);
  await em.flush();

  return {
    key: payload.key,
    id: document.id,
    publicId: document.publicId,
    title: document.title,
    workspaceId: payload.workspaceId,
    parentId: payload.parentDocumentId,
    teamspaceId: payload.teamspaceId,
  };
}

async function seedDocumentTree(
  em: EntityManager,
  workspaceId: string,
  teamspacesByKey: Map<string, TeamspaceEntity>,
  memberUsers: SeedUserSummary[],
  blueprint: DocumentBlueprint,
  replicaKey: string,
  sortKey: number,
  parentDocument?: SeedDocumentSummary,
): Promise<SeedDocumentSummary[]> {
  const owner = memberUsers[Math.abs(sortKey) % memberUsers.length]!;
  const publicId = buildSeededPublicId(`${replicaKey}:${blueprint.key}:${parentDocument?.id ?? 'root'}`);
  const summary = await upsertDocument(em, {
    key: blueprint.key,
    publicId,
    workspaceId,
    teamspaceId: blueprint.teamspaceKey ? teamspacesByKey.get(blueprint.teamspaceKey)?.id : parentDocument?.teamspaceId,
    parentDocumentId: parentDocument?.id,
    title: blueprint.title,
    contentJson: buildRealisticLeafContent({
      title: blueprint.title,
      summary: blueprint.summary,
      kind: blueprint.kind,
    }),
    sortKey,
    createdById: owner.id,
    updatedById: owner.id,
  });

  const allDocuments = [summary];
  const childDocuments: SeedDocumentSummary[] = [];

  for (const [index, childBlueprint] of (blueprint.children ?? []).entries()) {
    const nextDocuments = await seedDocumentTree(
      em,
      workspaceId,
      teamspacesByKey,
      memberUsers,
      childBlueprint,
      `${replicaKey}:${blueprint.key}`,
      index,
      summary,
    );

    childDocuments.push(nextDocuments[0]!);
    allDocuments.push(...nextDocuments);
  }

  if (childDocuments.length > 0) {
    const existingDocument = await em.findOneOrFail(DocumentEntity, { id: summary.id });
    const nextContent = buildRealisticParentContent({
      title: blueprint.title,
      summary: blueprint.summary,
      kind: blueprint.kind,
      childDocuments,
    });

    existingDocument.contentJson = nextContent;
    existingDocument.searchText = extractDocumentSearchText(nextContent);
    em.persist(existingDocument);
    await em.flush();
  }

  return allDocuments;
}

async function seedMemberPersonalDocuments(input: {
  em: EntityManager;
  workspaceId: string;
  memberUsers: SeedUserSummary[];
  replicaKey: string;
  startingSortKey: number;
}): Promise<SeedDocumentSummary[]> {
  const privateTemplates: Array<Pick<DocumentBlueprint, 'key' | 'title' | 'kind' | 'summary'>> = [
    {
      key: 'my-ai-notes',
      title: 'My AI Notes',
      kind: 'notes',
      summary: 'Personal notes for AI demo prep, open questions, and rough product thoughts.',
    },
    {
      key: 'draft-prompts',
      title: 'Draft Prompts',
      kind: 'wiki',
      summary: 'Private prompt drafts before they are reviewed and moved into the shared prompt library.',
    },
    {
      key: 'research-queue',
      title: 'Research Queue',
      kind: 'tracker',
      summary: 'Personal backlog of customer examples, evaluation ideas, and follow-up reading.',
    },
  ];
  const sharedTemplates: Array<Pick<DocumentBlueprint, 'key' | 'title' | 'kind' | 'summary'>> = [
    {
      key: 'shared-launch-review',
      title: 'Shared Launch Review',
      kind: 'notes',
      summary: 'Direct-shared review notes for launch readiness, product polish, and screenshot prep.',
    },
    {
      key: 'shared-eval-feedback',
      title: 'Shared Eval Feedback',
      kind: 'tracker',
      summary: 'Direct-shared feedback on answer quality, retrieval misses, and model behavior changes.',
    },
  ];
  const documents: SeedDocumentSummary[] = [];

  for (const [memberIndex, memberUser] of input.memberUsers.entries()) {
    for (const [templateIndex, template] of privateTemplates.entries()) {
      documents.push(await upsertDocument(input.em, {
        key: `${template.key}:${memberUser.email}`,
        publicId: buildSeededPublicId(`${input.replicaKey}:private:${memberUser.email}:${template.key}`),
        workspaceId: input.workspaceId,
        title: template.title,
        contentJson: buildRealisticLeafContent({
          title: template.title,
          summary: template.summary,
          kind: template.kind,
        }),
        sortKey: input.startingSortKey + (memberIndex * 10) + templateIndex,
        createdById: memberUser.id,
        updatedById: memberUser.id,
      }));
    }

    for (const [templateIndex, template] of sharedTemplates.entries()) {
      const owner = input.memberUsers[(memberIndex + templateIndex + 1) % input.memberUsers.length]!;
      const ownerFirstName = owner.displayName.split(' ')[0] ?? owner.displayName;
      const sharedTitle = `${ownerFirstName} ${template.title.replace(/^Shared /, '')}`;
      const document = await upsertDocument(input.em, {
        key: `${template.key}:${memberUser.email}`,
        publicId: buildSeededPublicId(`${input.replicaKey}:shared:${memberUser.email}:${template.key}`),
        workspaceId: input.workspaceId,
        title: sharedTitle,
        contentJson: buildRealisticLeafContent({
          title: sharedTitle,
          summary: template.summary,
          kind: template.kind,
        }),
        sortKey: input.startingSortKey + 500 + (memberIndex * 10) + templateIndex,
        createdById: owner.id,
        updatedById: owner.id,
      });

      const existingGrant = await input.em.findOne(DocumentAccessGrantEntity, {
        document: document.id,
        user: memberUser.id,
      });
      const grant = existingGrant ??
        input.em.create(DocumentAccessGrantEntity, {
          workspace: input.em.getReference(WorkspaceEntity, input.workspaceId),
          document: input.em.getReference(DocumentEntity, document.id),
          user: input.em.getReference(CurrentUserEntity, memberUser.id),
          permission: DocumentAccessGrantPermission.EDIT,
          grantedBy: input.em.getReference(CurrentUserEntity, owner.id),
        });

      grant.workspace = input.em.getReference(WorkspaceEntity, input.workspaceId);
      grant.document = input.em.getReference(DocumentEntity, document.id);
      grant.user = input.em.getReference(CurrentUserEntity, memberUser.id);
      grant.permission = DocumentAccessGrantPermission.EDIT;
      grant.grantedBy = input.em.getReference(CurrentUserEntity, owner.id);
      grant.revokedAt = undefined;
      input.em.persist(grant);
      documents.push(document);
    }
  }

  await input.em.flush();

  return documents;
}

async function seedWorkspacePreferences(
  em: EntityManager,
  workspaceId: string,
  memberUsers: SeedUserSummary[],
  documents: SeedDocumentSummary[],
): Promise<void> {
  const rootDocumentIds = documents.filter((document) => !document.parentId).map((document) => document.id);
  const existingPreferences = await em.find(WorkspacePreferenceEntity, {
    workspace: workspaceId,
    user: { $in: memberUsers.map((user) => user.id) },
  }, {
    populate: ['user'],
  });
  const existingByUserId = new Map(existingPreferences.map((preference) => [preference.user.id, preference]));

  for (const [index, memberUser] of memberUsers.entries()) {
    const preference = existingByUserId.get(memberUser.id) ??
      em.create(WorkspacePreferenceEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        user: em.getReference(CurrentUserEntity, memberUser.id),
        expandedDocumentIdsByScope: {},
      });

    preference.expandedDocumentIdsByScope = {
      ...preference.expandedDocumentIdsByScope,
      private: rootDocumentIds.slice(0, Math.max(1, 2 + (index % 2))),
    };
    em.persist(preference);
  }

  await em.flush();
}

async function seedDocumentAccessGrants(
  em: EntityManager,
  workspaceId: string,
  memberUsers: SeedUserSummary[],
  documents: SeedDocumentSummary[],
  grants: DocumentAccessGrantTemplate[] = [],
): Promise<void> {
  if (grants.length === 0) {
    return;
  }

  const usersByEmail = new Map(memberUsers.map((user) => [user.email, user]));
  const documentsByKey = new Map(documents.map((document) => [document.key, document]));

  for (const grantTemplate of grants) {
    const document = documentsByKey.get(grantTemplate.documentKey);
    const user = usersByEmail.get(grantTemplate.userEmail);
    const grantedBy = grantTemplate.grantedByEmail
      ? usersByEmail.get(grantTemplate.grantedByEmail)
      : memberUsers[0];

    if (!document || !user || !grantedBy) {
      continue;
    }

    const existingGrant = await em.findOne(DocumentAccessGrantEntity, {
      document: document.id,
      user: user.id,
    });
    const grant = existingGrant ??
      em.create(DocumentAccessGrantEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        document: em.getReference(DocumentEntity, document.id),
        user: em.getReference(CurrentUserEntity, user.id),
        permission: grantTemplate.permission,
        grantedBy: em.getReference(CurrentUserEntity, grantedBy.id),
      });

    grant.workspace = em.getReference(WorkspaceEntity, workspaceId);
    grant.document = em.getReference(DocumentEntity, document.id);
    grant.user = em.getReference(CurrentUserEntity, user.id);
    grant.permission = grantTemplate.permission;
    grant.grantedBy = em.getReference(CurrentUserEntity, grantedBy.id);
    grant.revokedAt = undefined;
    em.persist(grant);
  }

  await em.flush();
}

async function seedDocumentAccessSettings(
  em: EntityManager,
  workspaceId: string,
  memberUsers: SeedUserSummary[],
  documents: SeedDocumentSummary[],
  settings: DocumentAccessSettingTemplate[] = [],
): Promise<void> {
  if (settings.length === 0) {
    return;
  }

  const usersByEmail = new Map(memberUsers.map((user) => [user.email, user]));
  const documentsByKey = new Map(documents.map((document) => [document.key, document]));

  for (const settingTemplate of settings) {
    const document = documentsByKey.get(settingTemplate.documentKey);
    const updatedBy = settingTemplate.updatedByEmail
      ? usersByEmail.get(settingTemplate.updatedByEmail)
      : memberUsers[0];

    if (!document || !updatedBy) {
      continue;
    }

    const existingSetting = await em.findOne(DocumentAccessSettingEntity, {
      document: document.id,
    });
    const setting = existingSetting ??
      em.create(DocumentAccessSettingEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        document: em.getReference(DocumentEntity, document.id),
        updatedBy: em.getReference(CurrentUserEntity, updatedBy.id),
      });

    setting.workspace = em.getReference(WorkspaceEntity, workspaceId);
    setting.document = em.getReference(DocumentEntity, document.id);
    setting.workspaceMemberPermission = settingTemplate.workspaceMemberPermission;
    setting.updatedBy = em.getReference(CurrentUserEntity, updatedBy.id);
    em.persist(setting);
  }

  await em.flush();
}

async function seedFavoritesAndVisits(
  em: EntityManager,
  workspaceId: string,
  memberUsers: SeedUserSummary[],
  documents: SeedDocumentSummary[],
): Promise<void> {
  const rootDocuments = documents.filter((document) => !document.parentId);
  const favoriteDocuments = rootDocuments.slice(0, Math.min(3, rootDocuments.length));
  const visitDocuments = documents.slice(0, Math.min(8, documents.length));

  for (const [index, memberUser] of memberUsers.entries()) {
    for (const favoriteDocument of favoriteDocuments.slice(0, 1 + (index % 2))) {
      const existingFavorite = await em.findOne(DocumentFavoriteEntity, {
        workspace: workspaceId,
        user: memberUser.id,
        document: favoriteDocument.id,
      });

      if (!existingFavorite) {
        em.persist(
          em.create(DocumentFavoriteEntity, {
            workspace: em.getReference(WorkspaceEntity, workspaceId),
            user: em.getReference(CurrentUserEntity, memberUser.id),
            document: em.getReference(DocumentEntity, favoriteDocument.id),
          }),
        );
      }
    }

    for (const [visitOffset, visitDocument] of visitDocuments.slice(0, 3 + (index % 3)).entries()) {
      const existingVisit = await em.findOne(DocumentVisitEntity, {
        workspace: workspaceId,
        user: memberUser.id,
        document: visitDocument.id,
      });
      const visit = existingVisit ??
        em.create(DocumentVisitEntity, {
          workspace: em.getReference(WorkspaceEntity, workspaceId),
          user: em.getReference(CurrentUserEntity, memberUser.id),
          document: em.getReference(DocumentEntity, visitDocument.id),
          lastVisitedAt: new Date(),
        });

      visit.lastVisitedAt = new Date(Date.UTC(2026, 6, 1, 8 + index, visitOffset * 7));
      em.persist(visit);
    }
  }

  await em.flush();
}

async function seedPublishedDocs(
  em: EntityManager,
  workspaceId: string,
  memberUsers: SeedUserSummary[],
  documents: SeedDocumentSummary[],
): Promise<void> {
  const rootDocuments = documents.filter((document) => !document.parentId).slice(0, 2);
  const publishableDocuments = collectPublishedSubtreeDocuments(
    documents,
    rootDocuments.map((document) => document.id),
  );

  for (const [index, document] of publishableDocuments.entries()) {
    const existingPublishedDocument = await em.findOne(PublishedDocumentEntity, {
      document: document.id,
    });

    if (existingPublishedDocument) {
      continue;
    }

    em.persist(
      em.create(PublishedDocumentEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        document: em.getReference(DocumentEntity, document.id),
        publishedBy: em.getReference(CurrentUserEntity, memberUsers[index % memberUsers.length]!.id),
      }),
    );
  }

  await em.flush();
}

async function seedSubdocReferences(
  em: EntityManager,
  workspaceId: string,
  documents: SeedDocumentSummary[],
): Promise<void> {
  const childDocuments = documents.filter((document): document is SeedDocumentSummary & { parentId: string } => Boolean(document.parentId));

  for (const childDocument of childDocuments) {
    const existingReference = await em.findOne(DocumentSubdocReferenceEntity, {
      workspace: workspaceId,
      sourceDocument: childDocument.parentId,
      targetDocument: childDocument.id,
    });

    if (existingReference) {
      continue;
    }

    em.persist(
      em.create(DocumentSubdocReferenceEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        sourceDocument: em.getReference(DocumentEntity, childDocument.parentId),
        targetDocument: em.getReference(DocumentEntity, childDocument.id),
      }),
    );
  }

  await em.flush();
}

function buildBlockLimitLabContent(blockCount: number, limitLabel: string): unknown[] {
  return Array.from({ length: blockCount }, (_, index) =>
    paragraph(`Seed block ${index + 1}: ${limitLabel}`));
}

async function seedBlockLimitLabWorkspace(input: {
  em: EntityManager;
  users: SeedUserSummary[];
  slug: string;
  name: string;
  description: string;
  documentTitle: string;
  blockCount: number;
  limitLabel: string;
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
  const teamspacesByKey = await upsertTeamspaces(em, workspace.id, template.teamspaces);
  await upsertTeamspaceMembers(
    em,
    memberUsers.map((member) => member.user),
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
        memberUsers.map((member) => member.user),
        rootDocument,
        replicaKey,
        index,
      )),
    );
  }

  const memberSummaries = memberUsers.map((member) => member.user);
  documents.push(
    ...(await seedMemberPersonalDocuments({
      em,
      workspaceId: workspace.id,
      memberUsers: memberSummaries,
      replicaKey,
      startingSortKey: template.documents.length + 100,
    })),
  );

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

  await seedBlockLimitLabWorkspace({
    em,
    users,
    slug: 'seeded-block-limit-lab',
    name: 'Seeded Block Limit Lab',
    description: 'Free collaborative workspace seeded at the 1,000 block limit for upgrade prompt testing.',
    documentTitle: 'Limit Counter',
    blockCount: 1_000,
    limitLabel: 'collaborative Free workspaces cannot create block 1,001.',
  });
  await seedBlockLimitLabWorkspace({
    em,
    users,
    slug: 'seeded-over-limit-lab',
    name: 'Seeded Over Limit Lab',
    description: 'Free collaborative workspace seeded above the 1,000 block limit to test downgraded over-limit behavior.',
    documentTitle: 'Over Limit Counter',
    blockCount: 1_200,
    limitLabel: 'over-limit Free workspaces keep existing content but cannot create more blocks.',
  });

  console.log(`[seed][realistic] Total duration: ${formatDuration(Date.now() - startedAt)}`);
}
