import type { EntityManager } from '@mikro-orm/postgresql';
import { createHash } from 'node:crypto';
import { buildAuthConfig } from '../../src/config/auth.config';
import { UserStatus } from '../../src/modules/domains/auth/domain/enums/user-status.enum';
import { CurrentUserCredentialEntity } from '../../src/modules/domains/auth/infra/persistence/entities/current-user-credential.entity';
import { CurrentUserEntity } from '../../src/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { UserRoleEntity } from '../../src/modules/domains/auth/infra/persistence/entities/user-role.entity';
import { BcryptPasswordHasher } from '../../src/modules/domains/auth/infra/security/bcrypt-password-hasher';
import { DEFAULT_CONTENT_FORMAT } from '../../src/modules/domains/document/app/constants/document.constants';
import { extractDocumentSearchText } from '../../src/modules/domains/document/app/utils/document-search-text.util';
import { DocumentEntity } from '../../src/modules/domains/document/infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from '../../src/modules/domains/document/infra/persistence/entities/document-subdoc-reference.entity';
import { DocumentVisitEntity } from '../../src/modules/domains/document/infra/persistence/entities/document-visit.entity';
import { DocumentFavoriteEntity } from '../../src/modules/domains/favorite/infra/persistence/entities/document-favorite.entity';
import { PublishedDocumentEntity } from '../../src/modules/domains/publish/infra/persistence/entities/published-document.entity';
import { TeamspaceEntity } from '../../src/modules/domains/teamspace/infra/persistence/entities/teamspace.entity';
import { WorkspaceRole } from '../../src/modules/domains/workspace/domain/enums/workspace-role.enum';
import { WorkspaceEntity } from '../../src/modules/domains/workspace/infra/persistence/entities/workspace.entity';
import { WorkspaceMemberEntity } from '../../src/modules/domains/workspace/infra/persistence/entities/workspace-member.entity';
import { WorkspacePreferenceEntity } from '../../src/modules/domains/workspace-preference/infra/persistence/entities/workspace-preference.entity';
import { seedAuth, seedAuthReferenceData } from './auth.seed';

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
  id: string;
  publicId: string;
  title: string;
  workspaceId: string;
  parentId?: string;
  teamspaceId?: string;
};

type TeamspaceTemplate = {
  key: string;
  name: string;
  description: string;
};

type DocumentBlueprint = {
  key: string;
  title: string;
  kind: 'landing' | 'hub' | 'spec' | 'notes' | 'runbook' | 'roadmap' | 'wiki' | 'tracker';
  summary: string;
  teamspaceKey?: string;
  children?: DocumentBlueprint[];
};

type WorkspaceTemplate = {
  key: string;
  name: string;
  description: string;
  memberEmails: string[];
  teamspaces: TeamspaceTemplate[];
  documents: DocumentBlueprint[];
};

type DocumentPayload = {
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

type RealisticSeedState = {
  users: SeedUserSummary[];
  config: RealisticSeedConfig;
};

type TextBlock = {
  type: 'paragraph' | 'heading';
  props?: Record<string, unknown>;
  content: Array<{ type: 'text'; text: string }>;
};

const REALISTIC_USER_FIXTURES = [
  { email: 'maya.chen@example.com', displayName: 'Maya Chen', role: 'admin' },
  { email: 'jordan.lee@example.com', displayName: 'Jordan Lee', role: 'member' },
  { email: 'sofie.nguyen@example.com', displayName: 'Sofie Nguyen', role: 'member' },
  { email: 'alex.rivera@example.com', displayName: 'Alex Rivera', role: 'member' },
  { email: 'nina.patel@example.com', displayName: 'Nina Patel', role: 'member' },
  { email: 'omar.hassan@example.com', displayName: 'Omar Hassan', role: 'member' },
  { email: 'emily.tran@example.com', displayName: 'Emily Tran', role: 'member' },
  { email: 'daniel.kim@example.com', displayName: 'Daniel Kim', role: 'member' },
  { email: 'lucy.garcia@example.com', displayName: 'Lucy Garcia', role: 'member' },
];

const REALISTIC_WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    key: 'acme-product',
    name: 'Acme Product',
    description: 'Product, engineering, and go-to-market collaboration for the Acme workspace.',
    memberEmails: [
      'admin@example.com',
      'maya.chen@example.com',
      'jordan.lee@example.com',
      'sofie.nguyen@example.com',
      'alex.rivera@example.com',
      'member@example.com',
    ],
    teamspaces: [
      {
        key: 'engineering',
        name: 'Engineering',
        description: 'Architecture notes, release checklists, and technical runbooks.',
      },
      {
        key: 'product',
        name: 'Product',
        description: 'Specs, roadmap, and launch coordination documents.',
      },
    ],
    documents: [
      {
        key: 'home',
        title: 'Company Home',
        kind: 'landing',
        summary: 'Shared entry page with the most referenced planning docs.',
        children: [
          {
            key: 'weekly-highlights',
            title: 'Weekly Highlights',
            kind: 'notes',
            summary: 'Short summary of wins, risks, and decisions for the week.',
          },
          {
            key: 'launch-calendar',
            title: 'Launch Calendar',
            kind: 'tracker',
            summary: 'Milestones, launch owners, and current status by release.',
          },
        ],
      },
      {
        key: 'engineering-hub',
        title: 'Engineering Hub',
        kind: 'hub',
        summary: 'Starting point for architecture, incidents, and release operations.',
        teamspaceKey: 'engineering',
        children: [
          {
            key: 'architecture',
            title: 'Architecture Decisions',
            kind: 'wiki',
            summary: 'Decision log for data model, auth, and workspace architecture.',
          },
          {
            key: 'release-runbook',
            title: 'Release Runbook',
            kind: 'runbook',
            summary: 'Checklist for staging validation, rollout, and rollback.',
          },
          {
            key: 'incident-review',
            title: 'Incident Review Template',
            kind: 'notes',
            summary: 'Template for capture, analysis, and follow-up after incidents.',
          },
        ],
      },
      {
        key: 'product-hub',
        title: 'Product Planning',
        kind: 'hub',
        summary: 'Specs, roadmap, and launch messaging for active initiatives.',
        teamspaceKey: 'product',
        children: [
          {
            key: 'roadmap',
            title: 'Quarterly Roadmap',
            kind: 'roadmap',
            summary: 'Current quarter priorities with sequencing and dependencies.',
          },
          {
            key: 'docs-search-spec',
            title: 'Docs Search Spec',
            kind: 'spec',
            summary: 'Problem statement, goals, scope, and rollout plan for search.',
          },
          {
            key: 'launch-brief',
            title: 'Launch Brief',
            kind: 'notes',
            summary: 'Positioning, target audience, and readiness notes for launch.',
          },
        ],
      },
    ],
  },
  {
    key: 'northwind-ops',
    name: 'Northwind Operations',
    description: 'Customer operations and delivery playbooks for a services team.',
    memberEmails: [
      'member@example.com',
      'nina.patel@example.com',
      'omar.hassan@example.com',
      'emily.tran@example.com',
      'lucy.garcia@example.com',
    ],
    teamspaces: [
      {
        key: 'success',
        name: 'Customer Success',
        description: 'Onboarding scripts, account plans, and risk reviews.',
      },
      {
        key: 'delivery',
        name: 'Delivery',
        description: 'Implementation templates, project plans, and handoff docs.',
      },
    ],
    documents: [
      {
        key: 'ops-home',
        title: 'Operations Home',
        kind: 'landing',
        summary: 'Links to active accounts, templates, and current weekly focus.',
        children: [
          {
            key: 'account-health',
            title: 'Account Health Review',
            kind: 'tracker',
            summary: 'Weekly review of red accounts, churn risk, and executive follow-up.',
          },
        ],
      },
      {
        key: 'success-playbook',
        title: 'Success Playbook',
        kind: 'hub',
        summary: 'Core onboarding and renewal material used by the success team.',
        teamspaceKey: 'success',
        children: [
          {
            key: 'onboarding-plan',
            title: 'Onboarding Plan Template',
            kind: 'runbook',
            summary: 'Standard week-by-week onboarding plan for new accounts.',
          },
          {
            key: 'renewal-notes',
            title: 'Renewal Preparation Notes',
            kind: 'notes',
            summary: 'Talking points, objections, and expansion opportunities before renewal.',
          },
        ],
      },
      {
        key: 'delivery-handbook',
        title: 'Delivery Handbook',
        kind: 'hub',
        summary: 'Implementation process, risk register, and project kickoff material.',
        teamspaceKey: 'delivery',
        children: [
          {
            key: 'kickoff-agenda',
            title: 'Project Kickoff Agenda',
            kind: 'notes',
            summary: 'Agenda and outcomes expected during project kickoff.',
          },
          {
            key: 'implementation-spec',
            title: 'Implementation Scope',
            kind: 'spec',
            summary: 'Milestones, interfaces, and non-goals for a delivery project.',
          },
        ],
      },
    ],
  },
];

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
    landing: 'Use this page as the quick entry point for recurring work.',
    hub: 'This hub groups the working documents that the team opens most often.',
    spec: 'Capture the problem, scope, user impact, and rollout decisions here.',
    notes: 'Write concise notes, decisions, and open follow-ups after each meeting.',
    runbook: 'Keep operational steps explicit so the next person can execute without guesswork.',
    roadmap: 'Summarize the quarter priorities, tradeoffs, and sequencing decisions.',
    wiki: 'Document stable background context that new teammates need to ramp quickly.',
    tracker: 'Track ownership, status, and next actions in a lightweight shared format.',
  };

  return [
    heading(input.title, 2),
    paragraph(input.summary),
    heading('What This Covers', 3),
    paragraph(focusLineByKind[input.kind]),
    heading('Current Notes', 3),
    paragraph(`This page is seeded as realistic sample content for "${input.title}".`),
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
      });
    }
    else {
      teamspace.description = template.description;
    }

    em.persist(teamspace);
    teamspacesByKey.set(template.key, teamspace);
  }

  await em.flush();

  return teamspacesByKey;
}

async function upsertWorkspaceMembers(
  em: EntityManager,
  workspaceId: string,
  memberUsers: SeedUserSummary[],
): Promise<void> {
  const existingMemberships = await em.find(WorkspaceMemberEntity, {
    workspace: workspaceId,
    user: { $in: memberUsers.map((user) => user.id) },
  }, {
    populate: ['user'],
  });
  const existingByUserId = new Map(existingMemberships.map((membership) => [membership.user.id, membership]));

  for (const [index, memberUser] of memberUsers.entries()) {
    const role = index === 0
      ? WorkspaceRole.OWNER
      : index === 1
        ? WorkspaceRole.ADMIN
        : WorkspaceRole.MEMBER;
    const membership = existingByUserId.get(memberUser.id) ??
      em.create(WorkspaceMemberEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        user: em.getReference(CurrentUserEntity, memberUser.id),
        role,
        joinedAt: new Date(),
      });

    membership.role = role;
    em.persist(membership);
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
  document.updatedBy = em.getReference(CurrentUserEntity, payload.updatedById);
  em.persist(document);
  await em.flush();

  return {
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
        expandedDocumentIds: [],
      });

    preference.expandedDocumentIds = rootDocumentIds.slice(0, Math.max(1, 2 + (index % 2)));
    em.persist(preference);
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
  const baseMembers = findUsersByEmail(state.users, template.memberEmails);
  const takenUserIds = new Set(baseMembers.map((user) => user.id));
  const extraMembers = selectExtraMembers(state.users, takenUserIds, state.config.extraMembersPerWorkspace);
  const memberUsers = [...baseMembers, ...extraMembers];

  await upsertWorkspaceMembers(em, workspace.id, memberUsers);
  const teamspacesByKey = await upsertTeamspaces(em, workspace.id, template.teamspaces);

  const documents: SeedDocumentSummary[] = [];

  for (const [index, rootDocument] of template.documents.entries()) {
    documents.push(
      ...(await seedDocumentTree(
        em,
        workspace.id,
        teamspacesByKey,
        memberUsers,
        rootDocument,
        replicaKey,
        index,
      )),
    );
  }

  await seedWorkspacePreferences(em, workspace.id, memberUsers, documents);
  await seedFavoritesAndVisits(em, workspace.id, memberUsers, documents);
  await seedPublishedDocs(em, workspace.id, memberUsers, documents);
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

  console.log(`[seed][realistic] Total duration: ${formatDuration(Date.now() - startedAt)}`);
}
