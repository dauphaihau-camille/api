import type { EntityManager } from '@mikro-orm/postgresql';
import { UserEntity } from '../../../src/domains/user/infra/persistence/entities/user.entity';
import { DEFAULT_CONTENT_FORMAT } from '../../../src/domains/document/app/constants/document.constants';
import { extractDocumentSearchText } from '../../../src/domains/document/app/utils/document-search-text.util';
import { DocumentAccessGrantPermission } from '../../../src/domains/document/domain/enums/document-access-grant-permission.enum';
import { DocumentEntity } from '../../../src/domains/document/infra/persistence/entities/document.entity';
import { TeamspaceEntity } from '../../../src/domains/teamspace/infra/persistence/entities/teamspace.entity';
import { WorkspaceEntity } from '../../../src/domains/workspace/infra/persistence/entities/workspace.entity';
import type { DocumentBlueprint } from '../fixtures/realistic.types';
import { upsertDocumentAccessGrant } from './document-access.seed';
import {
  buildRealisticLeafContent,
  buildRealisticParentContent,
} from './document-content.seed';
import type { SeedDocumentSummary, SeedUserSummary } from './realistic-seed.types';
import { buildSeededPublicId } from './shared.seed';

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

type DocumentTemplate = Pick<DocumentBlueprint, 'key' | 'title' | 'kind' | 'summary'>;

const PERSONAL_DOCUMENT_TEMPLATES: DocumentTemplate[] = [
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

const SHARED_DOCUMENT_TEMPLATES: DocumentTemplate[] = [
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

export async function upsertDocument(
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
      createdBy: em.getReference(UserEntity, payload.createdById),
      ownerUser: em.getReference(UserEntity, payload.createdById),
      updatedBy: em.getReference(UserEntity, payload.updatedById),
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
  document.createdBy = em.getReference(UserEntity, payload.createdById);
  document.ownerUser = em.getReference(UserEntity, payload.createdById);
  document.updatedBy = em.getReference(UserEntity, payload.updatedById);
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

export async function seedDocumentTree(
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

export async function seedMemberPersonalDocuments(input: {
  em: EntityManager;
  workspaceId: string;
  memberUsers: SeedUserSummary[];
  replicaKey: string;
  startingSortKey: number;
}): Promise<SeedDocumentSummary[]> {
  const documents: SeedDocumentSummary[] = [];

  for (const [memberIndex, memberUser] of input.memberUsers.entries()) {
    for (const [templateIndex, template] of PERSONAL_DOCUMENT_TEMPLATES.entries()) {
      documents.push(await upsertDocument(input.em, {
        key: `${template.key}:${memberUser.email}`,
        publicId: buildSeededPublicId(`${input.replicaKey}:private:${memberUser.email}:${template.key}`),
        workspaceId: input.workspaceId,
        title: template.title,
        contentJson: buildRealisticLeafContent({
          summary: template.summary,
          kind: template.kind,
        }),
        sortKey: input.startingSortKey + (memberIndex * 10) + templateIndex,
        createdById: memberUser.id,
        updatedById: memberUser.id,
      }));
    }

    for (const [templateIndex, template] of SHARED_DOCUMENT_TEMPLATES.entries()) {
      const owner = input.memberUsers[(memberIndex + templateIndex + 1) % input.memberUsers.length]!;
      const ownerFirstName = owner.displayName.split(' ')[0] ?? owner.displayName;
      const sharedTitle = `${ownerFirstName} ${template.title.replace(/^Shared /, '')}`;
      const document = await upsertDocument(input.em, {
        key: `${template.key}:${memberUser.email}`,
        publicId: buildSeededPublicId(`${input.replicaKey}:shared:${memberUser.email}:${template.key}`),
        workspaceId: input.workspaceId,
        title: sharedTitle,
        contentJson: buildRealisticLeafContent({
          summary: template.summary,
          kind: template.kind,
        }),
        sortKey: input.startingSortKey + 500 + (memberIndex * 10) + templateIndex,
        createdById: owner.id,
        updatedById: owner.id,
      });

      await upsertDocumentAccessGrant({
        em: input.em,
        workspaceId: input.workspaceId,
        documentId: document.id,
        userId: memberUser.id,
        permission: DocumentAccessGrantPermission.EDIT,
        grantedById: owner.id,
      });
      documents.push(document);
    }
  }

  await input.em.flush();

  return documents;
}
