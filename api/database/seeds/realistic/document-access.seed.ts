import type { EntityManager } from '@mikro-orm/postgresql';
import { CurrentUserEntity } from '../../../src/domains/auth/infra/persistence/entities/current-user.entity';
import { DocumentAccessGrantEntity } from '../../../src/domains/document/infra/persistence/entities/document-access-grant.entity';
import { DocumentAccessSettingEntity } from '../../../src/domains/document/infra/persistence/entities/document-access-setting.entity';
import { DocumentEntity } from '../../../src/domains/document/infra/persistence/entities/document.entity';
import { WorkspaceEntity } from '../../../src/domains/workspace/infra/persistence/entities/workspace.entity';
import type {
  DocumentAccessGrantTemplate,
  DocumentAccessSettingTemplate,
} from '../fixtures/realistic.types';
import type {
  SeedDocumentSummary,
  SeedUserSummary,
  UpsertDocumentAccessGrantInput,
} from './realistic-seed.types';

export async function upsertDocumentAccessGrant(input: UpsertDocumentAccessGrantInput): Promise<void> {
  const existingGrant = await input.em.findOne(DocumentAccessGrantEntity, {
    document: input.documentId,
    user: input.userId,
  });
  const grant = existingGrant ??
    input.em.create(DocumentAccessGrantEntity, {
      workspace: input.em.getReference(WorkspaceEntity, input.workspaceId),
      document: input.em.getReference(DocumentEntity, input.documentId),
      user: input.em.getReference(CurrentUserEntity, input.userId),
      permission: input.permission,
      grantedBy: input.em.getReference(CurrentUserEntity, input.grantedById),
    });

  grant.workspace = input.em.getReference(WorkspaceEntity, input.workspaceId);
  grant.document = input.em.getReference(DocumentEntity, input.documentId);
  grant.user = input.em.getReference(CurrentUserEntity, input.userId);
  grant.permission = input.permission;
  grant.grantedBy = input.em.getReference(CurrentUserEntity, input.grantedById);
  grant.revokedAt = undefined;
  input.em.persist(grant);
}

export async function seedDocumentAccessGrants(
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

    await upsertDocumentAccessGrant({
      em,
      workspaceId,
      documentId: document.id,
      userId: user.id,
      permission: grantTemplate.permission,
      grantedById: grantedBy.id,
    });
  }

  await em.flush();
}

export async function seedDocumentAccessSettings(
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
