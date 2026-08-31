import type { EntityManager } from '@mikro-orm/postgresql';
import { CurrentUserEntity } from '../../../src/domains/auth/infra/persistence/entities/current-user.entity';
import { DocumentEntity } from '../../../src/domains/document/infra/persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from '../../../src/domains/document/infra/persistence/entities/document-subdoc-reference.entity';
import { DocumentVisitEntity } from '../../../src/domains/document/infra/persistence/entities/document-visit.entity';
import { DocumentFavoriteEntity } from '../../../src/domains/favorite/infra/persistence/entities/document-favorite.entity';
import { PublishedDocumentEntity } from '../../../src/domains/publish/infra/persistence/entities/published-document.entity';
import { WorkspaceEntity } from '../../../src/domains/workspace/infra/persistence/entities/workspace.entity';
import { WorkspacePreferenceEntity } from '../../../src/domains/workspace-preference/infra/persistence/entities/workspace-preference.entity';
import type { SeedDocumentSummary, SeedUserSummary } from './realistic-seed.types';

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

export async function seedWorkspacePreferences(
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

export async function seedFavoritesAndVisits(
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

export async function seedPublishedDocs(
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

export async function seedSubdocReferences(
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
