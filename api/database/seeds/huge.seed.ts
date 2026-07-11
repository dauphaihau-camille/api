import type { EntityManager } from '@mikro-orm/postgresql';
import { createHash } from 'node:crypto';
import { buildAuthConfig } from '../../src/config/auth.config';
import { BcryptPasswordHasher } from '../../src/modules/domains/auth/infra/security/bcrypt-password-hasher';
import { UserStatus } from '../../src/modules/domains/auth/domain/enums/user-status.enum';
import { CurrentUserCredentialEntity } from '../../src/modules/domains/auth/infra/persistence/entities/current-user-credential.entity';
import { CurrentUserEntity } from '../../src/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { UserRoleEntity } from '../../src/modules/domains/auth/infra/persistence/entities/user-role.entity';
import { DocumentEntity } from '../../src/modules/domains/document/infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from '../../src/modules/domains/document/infra/persistence/entities/document-subdoc-reference.entity';
import { DocumentVisitEntity } from '../../src/modules/domains/document/infra/persistence/entities/document-visit.entity';
import { DEFAULT_CONTENT_FORMAT } from '../../src/modules/domains/document/app/constants/document.constants';
import { extractDocumentSearchText } from '../../src/modules/domains/document/app/utils/document-search-text.util';
import { DocumentFavoriteEntity } from '../../src/modules/domains/favorite/infra/persistence/entities/document-favorite.entity';
import { PublishedDocumentEntity } from '../../src/modules/domains/publish/infra/persistence/entities/published-document.entity';
import { TeamspaceEntity } from '../../src/modules/domains/teamspace/infra/persistence/entities/teamspace.entity';
import { WorkspaceRole } from '../../src/modules/domains/workspace/domain/enums/workspace-role.enum';
import { WorkspaceEntity } from '../../src/modules/domains/workspace/infra/persistence/entities/workspace.entity';
import { WorkspaceMemberEntity } from '../../src/modules/domains/workspace/infra/persistence/entities/workspace-member.entity';
import { WorkspacePreferenceEntity } from '../../src/modules/domains/workspace-preference/infra/persistence/entities/workspace-preference.entity';
import { seedAuth, seedAuthReferenceData } from './auth.seed';

type HugeSeedConfig = {
  generatedUserCount: number;
  workspaceCount: number;
  membersPerWorkspace: number;
  teamspacesPerWorkspace: number;
  privateRootDocumentsPerWorkspace: number;
  teamspaceRootDocumentsPerTeamspace: number;
  childDocumentsPerParent: number;
  documentDepth: number;
  favoritesPerUser: number;
  visitsPerUser: number;
  publishedDocumentsPerWorkspace: number;
  subdocReferencesPerWorkspace: number;
  expandedDocumentsPerPreference: number;
  batchSize: number;
  password: string;
};

type SeedUserSummary = {
  id: string;
  email: string;
  displayName: string;
};

type SeedWorkspaceSummary = {
  id: string;
  slug: string;
  name: string;
};

type SeedTeamspaceSummary = {
  id: string;
  name: string;
};

type SeedDocumentSummary = {
  id: string;
  publicId: string;
  workspaceId: string;
  title: string;
  parentId?: string;
  teamspaceId?: string;
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

function formatDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }

  return `${(ms / 1_000).toFixed(1)}s`;
}

function resolvePositiveInteger(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  minimum = 0,
): number {
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

function resolveHugeSeedPassword(env: NodeJS.ProcessEnv): string {
  const configured = env.SEED_HUGE_DEFAULT_PASSWORD?.trim();

  return configured && configured.length > 0 ? configured : 'password123';
}

function resolveSeedBcryptSaltRounds(defaultRounds: number): number {
  const configuredRounds = Number(process.env.SEED_BCRYPT_SALT_ROUNDS ?? '4');

  if (Number.isFinite(configuredRounds) && configuredRounds > 0) {
    return configuredRounds;
  }

  return Math.min(defaultRounds, 4);
}

export function resolveHugeSeedConfig(env: NodeJS.ProcessEnv): HugeSeedConfig {
  return {
    generatedUserCount: resolvePositiveInteger(env, 'SEED_HUGE_USER_COUNT', 160),
    workspaceCount: resolvePositiveInteger(env, 'SEED_HUGE_WORKSPACE_COUNT', 8, 1),
    membersPerWorkspace: resolvePositiveInteger(env, 'SEED_HUGE_MEMBERS_PER_WORKSPACE', 20, 1),
    teamspacesPerWorkspace: resolvePositiveInteger(
      env,
      'SEED_HUGE_TEAMSPACES_PER_WORKSPACE',
      4,
    ),
    privateRootDocumentsPerWorkspace: resolvePositiveInteger(
      env,
      'SEED_HUGE_PRIVATE_ROOT_DOCUMENTS_PER_WORKSPACE',
      30,
    ),
    teamspaceRootDocumentsPerTeamspace: resolvePositiveInteger(
      env,
      'SEED_HUGE_TEAMSPACE_ROOT_DOCUMENTS_PER_TEAMSPACE',
      18,
    ),
    childDocumentsPerParent: resolvePositiveInteger(
      env,
      'SEED_HUGE_CHILD_DOCUMENTS_PER_PARENT',
      3,
    ),
    documentDepth: resolvePositiveInteger(env, 'SEED_HUGE_DOCUMENT_DEPTH', 3, 1),
    favoritesPerUser: resolvePositiveInteger(env, 'SEED_HUGE_FAVORITES_PER_USER', 12),
    visitsPerUser: resolvePositiveInteger(env, 'SEED_HUGE_VISITS_PER_USER', 20),
    publishedDocumentsPerWorkspace: resolvePositiveInteger(
      env,
      'SEED_HUGE_PUBLISHED_DOCUMENTS_PER_WORKSPACE',
      18,
    ),
    subdocReferencesPerWorkspace: resolvePositiveInteger(
      env,
      'SEED_HUGE_SUBDOC_REFERENCES_PER_WORKSPACE',
      24,
    ),
    expandedDocumentsPerPreference: resolvePositiveInteger(
      env,
      'SEED_HUGE_EXPANDED_DOCUMENTS_PER_PREFERENCE',
      8,
    ),
    batchSize: resolvePositiveInteger(env, 'SEED_HUGE_BATCH_SIZE', 250, 1),
    password: resolveHugeSeedPassword(env),
  };
}

function padNumber(value: number, width = 4): string {
  return value.toString().padStart(width, '0');
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function buildUserEmail(index: number): string {
  return `loadtest-user-${padNumber(index, 6)}@example.com`;
}

function buildUserDisplayName(index: number): string {
  return `Load Test User ${padNumber(index, 6)}`;
}

function buildWorkspaceSlug(index: number): string {
  return `loadtest-workspace-${padNumber(index)}`;
}

function buildWorkspaceName(index: number): string {
  return `Load Test Workspace ${padNumber(index)}`;
}

function buildWorkspaceDescription(index: number): string {
  return `Synthetic large-data workspace ${padNumber(index)}.`;
}

function buildTeamspaceName(workspaceIndex: number, teamspaceIndex: number): string {
  return `Teamspace ${padNumber(workspaceIndex)}-${padNumber(teamspaceIndex, 2)}`;
}

function buildDocumentContent(title: string, bodySeed: string): unknown[] {
  return [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: `${title} ${bodySeed}` }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: `Synthetic seed content for ${title}. Search token ${bodySeed}.`,
        },
      ],
    },
  ];
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

function buildParentDocumentContent(
  title: string,
  bodySeed: string,
  childDocuments: SeedDocumentSummary[],
): unknown[] {
  return [
    ...buildDocumentContent(title, bodySeed),
    ...childDocuments.map((childDocument) =>
      buildSubpageBlock({
        documentId: childDocument.id,
        publicId: childDocument.publicId,
        workspaceId: childDocument.workspaceId,
        title: childDocument.title,
      })),
  ];
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

function pickUniqueUsers(
  users: SeedUserSummary[],
  workspaceIndex: number,
  requestedCount: number,
): SeedUserSummary[] {
  if (users.length === 0) {
    throw new Error('Huge seed requires at least one user');
  }

  const targetCount = Math.min(requestedCount, users.length);
  const selected: SeedUserSummary[] = [];
  const seen = new Set<string>();
  let cursor = (workspaceIndex - 1) * Math.max(1, targetCount - 1);

  while (selected.length < targetCount) {
    const candidate = users[cursor % users.length]!;

    if (!seen.has(candidate.id)) {
      selected.push(candidate);
      seen.add(candidate.id);
    }

    cursor += 1;
  }

  return selected;
}

async function seedGeneratedUsers(
  em: EntityManager,
  config: HugeSeedConfig,
): Promise<SeedUserSummary[]> {
  const seededAuth = await seedAuth(em);
  const { roleByKey } = await seedAuthReferenceData(em);
  const memberRole = roleByKey.get('member');
  const adminRole = roleByKey.get('admin');

  if (!memberRole || !adminRole) {
    throw new Error('Huge seed requires both admin and member auth roles');
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
  const passwordHash = await passwordService.hash(config.password);
  const generatedEmails = Array.from(
    { length: config.generatedUserCount },
    (_, index) => buildUserEmail(index + 1),
  );
  const existingUsers =
    generatedEmails.length > 0
      ? await em.find(CurrentUserEntity, { email: { $in: generatedEmails } }, { populate: ['credential'] })
      : [];
  const existingUsersByEmail = new Map(existingUsers.map((user) => [user.email, user]));
  const existingUserRoles =
    generatedEmails.length > 0
      ? await em.find(
        UserRoleEntity,
        { user: { email: { $in: generatedEmails } } },
        { populate: ['user', 'role'] },
      )
      : [];
  const existingUserRoleKeys = new Set(
    existingUserRoles.map((userRole) => `${userRole.user.email}::${userRole.role.key}`),
  );
  const startedAt = Date.now();

  console.log(
    `[seed][huge] Upserting ${config.generatedUserCount} generated users with shared password`,
  );

  const users = Array.from(seededAuth.usersByEmail.values()).map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? user.email,
  }));

  for (const [index, email] of generatedEmails.entries()) {
    let user = existingUsersByEmail.get(email);

    if (!user) {
      user = em.create(CurrentUserEntity, {
        email,
        displayName: buildUserDisplayName(index + 1),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      });
      existingUsersByEmail.set(email, user);
    }
    else {
      user.displayName = buildUserDisplayName(index + 1);
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

    const authRole = index % 10 === 0 ? adminRole : memberRole;
    const userRoleKey = `${user.email}::${authRole.key}`;

    if (!existingUserRoleKeys.has(userRoleKey)) {
      em.persist(
        em.create(UserRoleEntity, {
          user,
          role: authRole,
          assignedAt: new Date(),
        }),
      );
      existingUserRoleKeys.add(userRoleKey);
    }

    em.persist(user);
    users.push({
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? user.email,
    });
  }

  await em.flush();

  console.log(
    `[seed][huge] Generated user pool: ${users.length} users in ${formatDuration(Date.now() - startedAt)}`,
  );

  return users;
}

async function upsertWorkspace(
  em: EntityManager,
  workspaceIndex: number,
): Promise<SeedWorkspaceSummary> {
  const slug = buildWorkspaceSlug(workspaceIndex);
  let workspace = await em.findOne(WorkspaceEntity, { slug });

  if (!workspace) {
    workspace = em.create(WorkspaceEntity, {
      slug,
      name: buildWorkspaceName(workspaceIndex),
      description: buildWorkspaceDescription(workspaceIndex),
    });
  }
  else {
    workspace.name = buildWorkspaceName(workspaceIndex);
    workspace.description = buildWorkspaceDescription(workspaceIndex);
  }

  em.persist(workspace);
  await em.flush();

  return {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
  };
}

async function seedWorkspaceMemberships(
  em: EntityManager,
  workspaceId: string,
  memberUsers: SeedUserSummary[],
): Promise<void> {
  const existingMemberships =
    memberUsers.length > 0
      ? await em.find(WorkspaceMemberEntity, {
        workspace: workspaceId,
        user: { $in: memberUsers.map((user) => user.id) },
      }, {
        populate: ['user'],
      })
      : [];
  const existingMembershipsByUserId = new Map(
    existingMemberships.map((membership) => [membership.user.id, membership]),
  );

  for (const [index, memberUser] of memberUsers.entries()) {
    const role = index === 0
      ? WorkspaceRole.OWNER
      : index === 1
        ? WorkspaceRole.ADMIN
        : WorkspaceRole.MEMBER;
    const existingMembership = existingMembershipsByUserId.get(memberUser.id);

    if (existingMembership) {
      existingMembership.role = role;
      em.persist(existingMembership);
      continue;
    }

    em.persist(
      em.create(WorkspaceMemberEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        user: em.getReference(CurrentUserEntity, memberUser.id),
        role,
        joinedAt: new Date(),
      }),
    );
  }

  await em.flush();
}

async function upsertTeamspaces(
  em: EntityManager,
  workspaceId: string,
  workspaceIndex: number,
  teamspacesPerWorkspace: number,
): Promise<SeedTeamspaceSummary[]> {
  if (teamspacesPerWorkspace === 0) {
    return [];
  }

  const names = Array.from(
    { length: teamspacesPerWorkspace },
    (_, index) => buildTeamspaceName(workspaceIndex, index + 1),
  );
  const existingTeamspaces = await em.find(TeamspaceEntity, {
    workspace: workspaceId,
    name: { $in: names },
  });
  const existingByName = new Map(existingTeamspaces.map((teamspace) => [teamspace.name, teamspace]));
  const teamspaces: SeedTeamspaceSummary[] = [];

  for (const [index, name] of names.entries()) {
    let teamspace = existingByName.get(name);

    if (!teamspace) {
      teamspace = em.create(TeamspaceEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        name,
        description: `Synthetic teamspace ${padNumber(index + 1, 2)} for workspace ${padNumber(workspaceIndex)}.`,
      });
    }
    else {
      teamspace.description = `Synthetic teamspace ${padNumber(index + 1, 2)} for workspace ${padNumber(workspaceIndex)}.`;
    }

    em.persist(teamspace);
    teamspaces.push({
      id: teamspace.id,
      name: teamspace.name,
    });
  }

  await em.flush();

  return teamspaces;
}

async function upsertDocumentPayloads(
  em: EntityManager,
  payloads: DocumentPayload[],
  batchSize: number,
): Promise<SeedDocumentSummary[]> {
  const summaries: SeedDocumentSummary[] = [];

  for (const payloadChunk of chunk(payloads, batchSize)) {
    const existingDocuments = await em.find(DocumentEntity, {
      publicId: { $in: payloadChunk.map((payload) => payload.publicId) },
    });
    const existingByPublicId = new Map(
      existingDocuments.map((document) => [document.publicId, document]),
    );

    for (const payload of payloadChunk) {
      const document = existingByPublicId.get(payload.publicId) ??
        em.create(DocumentEntity, {
          publicId: payload.publicId,
          workspace: em.getReference(WorkspaceEntity, payload.workspaceId),
          teamspace: payload.teamspaceId
            ? em.getReference(TeamspaceEntity, payload.teamspaceId)
            : undefined,
          parentDocument: payload.parentDocumentId
            ? em.getReference(DocumentEntity, payload.parentDocumentId)
            : undefined,
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
      summaries.push({
        id: document.id,
        publicId: document.publicId,
        workspaceId: payload.workspaceId,
        title: payload.title,
        parentId: payload.parentDocumentId,
        teamspaceId: payload.teamspaceId,
      });
    }

    await em.flush();
    em.clear();
  }

  return summaries;
}

async function syncSeededSubpageContent(
  em: EntityManager,
  documents: SeedDocumentSummary[],
): Promise<void> {
  const childrenByParentId = new Map<string, SeedDocumentSummary[]>();

  for (const document of documents) {
    if (!document.parentId) {
      continue;
    }

    const currentChildren = childrenByParentId.get(document.parentId) ?? [];
    currentChildren.push(document);
    childrenByParentId.set(document.parentId, currentChildren);
  }

  const parentDocumentIds = [...childrenByParentId.keys()];

  if (parentDocumentIds.length === 0) {
    return;
  }

  const parentDocuments = await em.find(DocumentEntity, {
    id: { $in: parentDocumentIds },
  });

  for (const parentDocument of parentDocuments) {
    const childDocuments = (childrenByParentId.get(parentDocument.id) ?? [])
      .slice()
      .sort((left, right) => left.title.localeCompare(right.title));

    if (childDocuments.length === 0) {
      continue;
    }

    const nextContent = buildParentDocumentContent(
      parentDocument.title,
      parentDocument.publicId,
      childDocuments,
    );

    parentDocument.contentJson = nextContent;
    parentDocument.searchText = extractDocumentSearchText(nextContent);
    em.persist(parentDocument);
  }

  await em.flush();
}

async function seedWorkspaceDocuments(
  em: EntityManager,
  config: HugeSeedConfig,
  workspaceId: string,
  workspaceIndex: number,
  teamspaces: SeedTeamspaceSummary[],
  memberUsers: SeedUserSummary[],
): Promise<SeedDocumentSummary[]> {
  const rootPayloads: DocumentPayload[] = [];

  for (let rootIndex = 1; rootIndex <= config.privateRootDocumentsPerWorkspace; rootIndex += 1) {
    const author = memberUsers[(rootIndex - 1) % memberUsers.length]!;
    const title = `Private Root ${padNumber(workspaceIndex)}-${padNumber(rootIndex, 3)}`;
    const publicId = buildSeededPublicId(
      `private:${workspaceIndex}:${rootIndex}`,
    );

    rootPayloads.push({
      publicId,
      workspaceId,
      title,
      contentJson: buildDocumentContent(title, publicId),
      sortKey: rootIndex - 1,
      createdById: author.id,
      updatedById: author.id,
    });
  }

  for (const [teamspaceOffset, teamspace] of teamspaces.entries()) {
    for (
      let rootIndex = 1;
      rootIndex <= config.teamspaceRootDocumentsPerTeamspace;
      rootIndex += 1
    ) {
      const author = memberUsers[(teamspaceOffset + rootIndex - 1) % memberUsers.length]!;
      const title = `Teamspace Root ${teamspace.name} ${padNumber(rootIndex, 3)}`;
      const publicId = buildSeededPublicId(
        `teamspace:${workspaceIndex}:${teamspaceOffset + 1}:${rootIndex}`,
      );

      rootPayloads.push({
        publicId,
        workspaceId,
        teamspaceId: teamspace.id,
        title,
        contentJson: buildDocumentContent(title, publicId),
        sortKey: rootIndex - 1,
        createdById: author.id,
        updatedById: author.id,
      });
    }
  }

  const allDocuments = await upsertDocumentPayloads(em, rootPayloads, config.batchSize);
  let parentLevel = [...allDocuments];

  for (let depth = 2; depth <= config.documentDepth; depth += 1) {
    const levelPayloads: DocumentPayload[] = [];

    for (const [parentIndex, parentDocument] of parentLevel.entries()) {
      for (let childIndex = 1; childIndex <= config.childDocumentsPerParent; childIndex += 1) {
        const author = memberUsers[(parentIndex + childIndex + depth - 1) % memberUsers.length]!;
        const title = `Nested ${depth}.${childIndex} ${parentDocument.publicId}`;
        const publicId = buildSeededPublicId(
          `${parentDocument.publicId}:${depth}:${childIndex}`,
        );

        levelPayloads.push({
          publicId,
          workspaceId,
          teamspaceId: parentDocument.teamspaceId,
          parentDocumentId: parentDocument.id,
          title,
          contentJson: buildDocumentContent(title, publicId),
          sortKey: childIndex - 1,
          createdById: author.id,
          updatedById: author.id,
        });
      }
    }

    const levelDocuments = await upsertDocumentPayloads(em, levelPayloads, config.batchSize);
    allDocuments.push(...levelDocuments);
    parentLevel = levelDocuments;
  }

  await syncSeededSubpageContent(em, allDocuments);

  return allDocuments;
}

async function seedWorkspacePreferences(
  em: EntityManager,
  config: HugeSeedConfig,
  workspaceId: string,
  memberUsers: SeedUserSummary[],
  documents: SeedDocumentSummary[],
): Promise<void> {
  const rootDocumentIds = documents.filter((document) => !document.parentId).map((document) => document.id);
  const existingPreferences =
    memberUsers.length > 0
      ? await em.find(WorkspacePreferenceEntity, {
        workspace: workspaceId,
        user: { $in: memberUsers.map((user) => user.id) },
      }, {
        populate: ['user'],
      })
      : [];
  const existingByUserId = new Map(existingPreferences.map((preference) => [preference.user.id, preference]));

  for (const [index, user] of memberUsers.entries()) {
    const expandedDocumentIds = rootDocumentIds.slice(index, index + config.expandedDocumentsPerPreference);
    const preference = existingByUserId.get(user.id) ??
      em.create(WorkspacePreferenceEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        user: em.getReference(CurrentUserEntity, user.id),
        expandedDocumentIds: [],
      });

    preference.expandedDocumentIds = expandedDocumentIds;
    em.persist(preference);
  }

  await em.flush();
}

async function seedDocumentFavorites(
  em: EntityManager,
  config: HugeSeedConfig,
  workspaceId: string,
  memberUsers: SeedUserSummary[],
  documents: SeedDocumentSummary[],
): Promise<void> {
  if (config.favoritesPerUser === 0 || documents.length === 0) {
    return;
  }

  const candidateDocuments = documents.filter((document) => !document.parentId);
  const desiredPairs = memberUsers.flatMap((user, userIndex) =>
    Array.from({
      length: Math.min(config.favoritesPerUser, candidateDocuments.length),
    }, (_, offset) => ({
      userId: user.id,
      documentId: candidateDocuments[(userIndex + offset) % candidateDocuments.length]!.id,
    })),
  );
  const existingFavorites =
    desiredPairs.length > 0
      ? await em.find(DocumentFavoriteEntity, {
        workspace: workspaceId,
        user: { $in: memberUsers.map((user) => user.id) },
        document: { $in: candidateDocuments.map((document) => document.id) },
      }, {
        populate: ['user', 'document'],
      })
      : [];
  const existingKeys = new Set(
    existingFavorites.map((favorite) => `${favorite.user.id}::${favorite.document.id}`),
  );

  for (const pair of desiredPairs) {
    const key = `${pair.userId}::${pair.documentId}`;

    if (existingKeys.has(key)) {
      continue;
    }

    em.persist(
      em.create(DocumentFavoriteEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        user: em.getReference(CurrentUserEntity, pair.userId),
        document: em.getReference(DocumentEntity, pair.documentId),
      }),
    );
    existingKeys.add(key);
  }

  await em.flush();
}

async function seedDocumentVisits(
  em: EntityManager,
  config: HugeSeedConfig,
  workspaceId: string,
  memberUsers: SeedUserSummary[],
  documents: SeedDocumentSummary[],
): Promise<void> {
  if (config.visitsPerUser === 0 || documents.length === 0) {
    return;
  }

  const desiredPairs = memberUsers.flatMap((user, userIndex) =>
    Array.from({
      length: Math.min(config.visitsPerUser, documents.length),
    }, (_, offset) => ({
      userId: user.id,
      documentId: documents[((userIndex * 3) + offset) % documents.length]!.id,
      lastVisitedAt: new Date(Date.UTC(2026, 0, 1, 0, (userIndex * 7) + offset)),
    })),
  );
  const existingVisits =
    desiredPairs.length > 0
      ? await em.find(DocumentVisitEntity, {
        workspace: workspaceId,
        user: { $in: memberUsers.map((user) => user.id) },
        document: { $in: documents.map((document) => document.id) },
      }, {
        populate: ['user', 'document'],
      })
      : [];
  const existingByKey = new Map(
    existingVisits.map((visit) => [`${visit.user.id}::${visit.document.id}`, visit]),
  );

  for (const pair of desiredPairs) {
    const key = `${pair.userId}::${pair.documentId}`;
    const visit = existingByKey.get(key) ??
      em.create(DocumentVisitEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        user: em.getReference(CurrentUserEntity, pair.userId),
        document: em.getReference(DocumentEntity, pair.documentId),
        lastVisitedAt: pair.lastVisitedAt,
      });

    visit.lastVisitedAt = pair.lastVisitedAt;
    em.persist(visit);
  }

  await em.flush();
}

async function seedPublishedDocuments(
  em: EntityManager,
  config: HugeSeedConfig,
  workspaceId: string,
  memberUsers: SeedUserSummary[],
  documents: SeedDocumentSummary[],
): Promise<void> {
  if (config.publishedDocumentsPerWorkspace === 0 || documents.length === 0) {
    return;
  }

  const publishableDocuments = documents.filter((document) => !document.parentId);
  const selectedRootDocuments = publishableDocuments.slice(0, config.publishedDocumentsPerWorkspace);
  const selectedDocuments = collectPublishedSubtreeDocuments(
    documents,
    selectedRootDocuments.map((document) => document.id),
  );
  const existingPublishedDocuments =
    selectedDocuments.length > 0
      ? await em.find(PublishedDocumentEntity, {
        document: { $in: selectedDocuments.map((document) => document.id) },
      }, {
        populate: ['document'],
      })
      : [];
  const existingDocumentIds = new Set(
    existingPublishedDocuments.map((publishedDocument) => publishedDocument.document.id),
  );

  for (const [index, document] of selectedDocuments.entries()) {
    if (existingDocumentIds.has(document.id)) {
      continue;
    }

    const publisher = memberUsers[index % memberUsers.length]!;
    em.persist(
      em.create(PublishedDocumentEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        document: em.getReference(DocumentEntity, document.id),
        publishedBy: em.getReference(CurrentUserEntity, publisher.id),
      }),
    );
  }

  await em.flush();
}

async function seedDocumentSubdocReferences(
  em: EntityManager,
  config: HugeSeedConfig,
  workspaceId: string,
  documents: SeedDocumentSummary[],
): Promise<void> {
  const treePairs = documents
    .filter((document): document is SeedDocumentSummary & { parentId: string } => Boolean(document.parentId))
    .map((document) => ({
      sourceDocumentId: document.parentId,
      targetDocumentId: document.id,
    }));

  if (treePairs.length === 0 && (config.subdocReferencesPerWorkspace === 0 || documents.length < 2)) {
    return;
  }

  const extraPairs = Array.from({
    length: Math.min(config.subdocReferencesPerWorkspace, Math.max(documents.length - 1, 0)),
  }, (_, index) => ({
    sourceDocumentId: documents[index]!.id,
    targetDocumentId: documents[(index + 1) % documents.length]!.id,
  })).filter((pair) => pair.sourceDocumentId !== pair.targetDocumentId);
  const desiredPairs = [...new Map(
    [...treePairs, ...extraPairs].map((pair) => [
      `${pair.sourceDocumentId}::${pair.targetDocumentId}`,
      pair,
    ]),
  ).values()];
  const existingReferences =
    desiredPairs.length > 0
      ? await em.find(DocumentSubdocReferenceEntity, {
        workspace: workspaceId,
        sourceDocument: { $in: desiredPairs.map((pair) => pair.sourceDocumentId) },
        targetDocument: { $in: desiredPairs.map((pair) => pair.targetDocumentId) },
      }, {
        populate: ['sourceDocument', 'targetDocument'],
      })
      : [];
  const existingKeys = new Set(
    existingReferences.map(
      (reference) => `${reference.sourceDocument.id}::${reference.targetDocument.id}`,
    ),
  );

  for (const pair of desiredPairs) {
    const key = `${pair.sourceDocumentId}::${pair.targetDocumentId}`;

    if (existingKeys.has(key)) {
      continue;
    }

    em.persist(
      em.create(DocumentSubdocReferenceEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        sourceDocument: em.getReference(DocumentEntity, pair.sourceDocumentId),
        targetDocument: em.getReference(DocumentEntity, pair.targetDocumentId),
      }),
    );
    existingKeys.add(key);
  }

  await em.flush();
}

export async function seedHugeData(em: EntityManager): Promise<void> {
  const config = resolveHugeSeedConfig(process.env);
  const startedAt = Date.now();

  console.log(`[seed][huge] Starting large synthetic seed with config ${JSON.stringify(config)}`);

  const users = await seedGeneratedUsers(em, config);
  console.log(`[seed][huge] User pool ready with ${users.length} users`);

  for (let workspaceIndex = 1; workspaceIndex <= config.workspaceCount; workspaceIndex += 1) {
    const workspaceStartedAt = Date.now();
    const workspace = await upsertWorkspace(em, workspaceIndex);
    const memberUsers = pickUniqueUsers(users, workspaceIndex, config.membersPerWorkspace);
    await seedWorkspaceMemberships(em, workspace.id, memberUsers);
    const teamspaces = await upsertTeamspaces(
      em,
      workspace.id,
      workspaceIndex,
      config.teamspacesPerWorkspace,
    );
    const documents = await seedWorkspaceDocuments(
      em,
      config,
      workspace.id,
      workspaceIndex,
      teamspaces,
      memberUsers,
    );
    await seedWorkspacePreferences(em, config, workspace.id, memberUsers, documents);
    await seedDocumentFavorites(em, config, workspace.id, memberUsers, documents);
    await seedDocumentVisits(em, config, workspace.id, memberUsers, documents);
    await seedPublishedDocuments(em, config, workspace.id, memberUsers, documents);
    await seedDocumentSubdocReferences(em, config, workspace.id, documents);

    console.log(
      `[seed][huge] Workspace ${workspace.slug} seeded with ${memberUsers.length} members, ${teamspaces.length} teamspaces, and ${documents.length} documents in ${formatDuration(Date.now() - workspaceStartedAt)}`,
    );
    em.clear();
  }

  console.log(`[seed][huge] Total duration: ${formatDuration(Date.now() - startedAt)}`);
}
