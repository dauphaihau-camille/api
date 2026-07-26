import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { TeamspaceMemberEntity } from '../../teamspace/infra/persistence/entities/teamspace-member.entity';
import { WorkspaceMemberEntity } from '../../workspace/infra/persistence/entities/workspace-member.entity';
import type {
  DocumentCollaborationAccess,
  PersistedDocumentCollaborationState,
} from '../app/ports/document-collaboration.repository';
import { DocumentCollaborationRepository } from '../app/ports/document-collaboration.repository';
import { extractDocumentSearchText } from '../app/utils/document-search-text.util';
import { DocumentAccessGrantPermission } from '../domain/enums/document-access-grant-permission.enum';
import { DocumentCollaborationSnapshotEntity } from './persistence/entities/document-collaboration-snapshot.entity';
import { DocumentCollaborationUpdateEntity } from './persistence/entities/document-collaboration-update.entity';
import { DocumentAccessGrantEntity } from './persistence/entities/document-access-grant.entity';
import { DocumentAccessSettingEntity } from './persistence/entities/document-access-setting.entity';
import { DocumentEntity } from './persistence/entities/document.entity';
import { DocumentSubdocReferenceEntity } from './persistence/entities/document-subdoc-reference.entity';

@Injectable()
export class MikroOrmDocumentCollaborationRepository extends DocumentCollaborationRepository {
  constructor(private readonly entityManager: EntityManager) {
    super();
  }

  async getAccess(
    documentId: string,
    userId: string,
  ): Promise<DocumentCollaborationAccess | null> {
    const entityManager = this.entityManager.fork();

    const document = await entityManager.findOne(DocumentEntity, documentId, {
      populate: ['workspace', 'teamspace', 'ownerUser'],
    });

    if (!document) {
      return null;
    }

    const membership = await entityManager.findOne(WorkspaceMemberEntity, {
      workspace: document.workspace.id,
      user: userId,
    });

    if (!membership) {
      return null;
    }

    const teamspaceMembership = document.teamspace
      ? await entityManager.findOne(TeamspaceMemberEntity, {
        teamspace: document.teamspace.id,
        user: userId,
      })
      : null;

    const directGrant = await entityManager.findOne(DocumentAccessGrantEntity, {
      document: document.id,
      user: userId,
      revokedAt: null,
    });
    const ancestorGrantPermission = await this.findStrongestActiveGrantPermissionInAncestors({
      documentId: document.id,
      entityManager,
      userId,
    });

    const accessSetting = await entityManager.findOne(DocumentAccessSettingEntity, {
      document: document.id,
    });

    return {
      content: document.contentJson,
      title: document.title,
      documentOwnerUserId: document.ownerUser.id,
      documentTeamspaceId: document.teamspace?.id,
      teamspaceAccessMode: document.teamspace?.accessMode,
      teamspaceMemberRole: teamspaceMembership?.role,
      directGrantPermission: directGrant?.permission,
      ancestorGrantPermission,
      workspaceMemberPermission: accessSetting?.workspaceMemberPermission,
      workspaceId: document.workspace.id,
      workspaceRole: membership.role,
    };
  }

  async loadState(
    documentId: string,
  ): Promise<PersistedDocumentCollaborationState | null> {
    const entityManager = this.entityManager.fork();

    const snapshot = await entityManager.findOne(
      DocumentCollaborationSnapshotEntity,
      { document: documentId },
    );

    if (!snapshot) {
      return null;
    }

    const updates = await entityManager.find(
      DocumentCollaborationUpdateEntity,
      {
        document: documentId,
        sequence: { $gt: snapshot.sequence },
      },
      { orderBy: { sequence: 'asc' } },
    );

    return {
      sequence: snapshot.latestSequence,
      snapshot: new Uint8Array(snapshot.snapshot),
      updates: updates.map((update) => ({
        sequence: update.sequence,
        update: new Uint8Array(update.update),
      })),
    };
  }

  async initializeState(
    documentId: string,
    snapshot: Uint8Array,
  ): Promise<PersistedDocumentCollaborationState> {
    const entityManager = this.entityManager.fork();

    return entityManager.transactional(async (transactionalEntityManager) => {
      const existing = await transactionalEntityManager.findOne(
        DocumentCollaborationSnapshotEntity,
        { document: documentId },
      );

      if (existing) {
        return this.loadState(documentId) as Promise<PersistedDocumentCollaborationState>;
      }

      const collaborationSnapshot = transactionalEntityManager.create(
        DocumentCollaborationSnapshotEntity,
        {
          document: documentId,
          snapshot: Buffer.from(snapshot),
          sequence: 0,
          latestSequence: 0,
          projectionSequence: 0,
        },
      );
      transactionalEntityManager.persist(collaborationSnapshot);
      await transactionalEntityManager.flush();

      return {
        sequence: 0,
        snapshot,
        updates: [],
      };
    });
  }

  async replaceState(
    documentId: string,
    snapshot: Uint8Array,
  ): Promise<PersistedDocumentCollaborationState> {
    const entityManager = this.entityManager.fork();

    return entityManager.transactional(async (transactionalEntityManager) => {
      const existing = await transactionalEntityManager.findOne(
        DocumentCollaborationSnapshotEntity,
        { document: documentId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );

      if (!existing) {
        return this.initializeState(documentId, snapshot);
      }

      existing.snapshot = Buffer.from(snapshot);
      existing.sequence = 0;
      existing.latestSequence = 0;
      existing.projectionSequence = -1;

      await transactionalEntityManager.nativeDelete(
        DocumentCollaborationUpdateEntity,
        { document: documentId },
      );
      await transactionalEntityManager.flush();

      return {
        sequence: 0,
        snapshot,
        updates: [],
      };
    });
  }

  async appendUpdate(
    documentId: string,
    update: Uint8Array,
    updateHash: string,
  ): Promise<number> {
    const entityManager = this.entityManager.fork();

    return entityManager.transactional(async (transactionalEntityManager) => {
      const duplicate = await transactionalEntityManager.findOne(
        DocumentCollaborationUpdateEntity,
        { document: documentId, updateHash },
      );

      if (duplicate) {
        return duplicate.sequence;
      }

      const snapshot = await transactionalEntityManager.findOneOrFail(
        DocumentCollaborationSnapshotEntity,
        { document: documentId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      const sequence = snapshot.latestSequence + 1;
      snapshot.latestSequence = sequence;

      transactionalEntityManager.persist(
        transactionalEntityManager.create(DocumentCollaborationUpdateEntity, {
          document: documentId,
          sequence,
          updateHash,
          update: Buffer.from(update),
        }),
      );
      await transactionalEntityManager.flush();

      return sequence;
    });
  }

  async saveProjection(
    documentId: string,
    sequence: number,
    title: string,
    content: unknown[],
    referencedDocumentIds: string[],
    updatedByUserId: string,
  ): Promise<{ updatedAt: Date }> {
    const entityManager = this.entityManager.fork();
    let updatedAt: Date | null = null;

    await entityManager.transactional(async (transactionalEntityManager) => {
      const snapshot = await transactionalEntityManager.findOneOrFail(
        DocumentCollaborationSnapshotEntity,
        { document: documentId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      const document = await transactionalEntityManager.findOneOrFail(
        DocumentEntity,
        documentId,
        { populate: ['workspace'] },
      );

      if (snapshot.projectionSequence >= sequence) {
        updatedAt = document.updatedAt;
        return;
      }

      const existingReferences = await transactionalEntityManager.find(
        DocumentSubdocReferenceEntity,
        { sourceDocument: documentId },
      );
      transactionalEntityManager.remove(existingReferences);

      if (referencedDocumentIds.length > 0) {
        const targetDocuments = await transactionalEntityManager.find(
          DocumentEntity,
          {
            id: { $in: referencedDocumentIds },
            workspace: document.workspace.id,
          },
        );

        for (const targetDocument of targetDocuments) {
          transactionalEntityManager.persist(
            transactionalEntityManager.create(DocumentSubdocReferenceEntity, {
              workspace: document.workspace,
              sourceDocument: document,
              targetDocument,
            }),
          );
        }
      }

      const [savedDocument] = await transactionalEntityManager.getConnection().execute<
        Array<{ updated_at: Date | string }>
      >(
        `update "documents"
         set "title" = ?, "content_json" = cast(? as jsonb), "search_text" = ?, "updated_by" = ?, "updated_at" = now()
         where "id" = ?
         returning "updated_at"`,
        [
          title,
          JSON.stringify(content),
          extractDocumentSearchText(content),
          updatedByUserId,
          documentId,
        ],
      );
      updatedAt = new Date(savedDocument.updated_at);
      snapshot.projectionSequence = sequence;
      await transactionalEntityManager.flush();
    });

    if (!updatedAt) {
      throw new Error('Document projection save did not return updated_at');
    }

    return { updatedAt };
  }

  async compactState(
    documentId: string,
    sequence: number,
    snapshotValue: Uint8Array,
  ): Promise<void> {
    const entityManager = this.entityManager.fork();

    await entityManager.transactional(async (transactionalEntityManager) => {
      const snapshot = await transactionalEntityManager.findOneOrFail(
        DocumentCollaborationSnapshotEntity,
        { document: documentId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );

      if (snapshot.sequence >= sequence || snapshot.latestSequence < sequence) {
        return;
      }

      snapshot.snapshot = Buffer.from(snapshotValue);
      snapshot.sequence = sequence;

      await transactionalEntityManager.nativeDelete(
        DocumentCollaborationUpdateEntity,
        {
          document: documentId,
          sequence: { $lte: sequence },
        },
      );
      await transactionalEntityManager.flush();
    });
  }

  private async findStrongestActiveGrantPermissionInAncestors(input: {
    documentId: string;
    entityManager: EntityManager;
    userId: string;
  }): Promise<DocumentAccessGrantPermission | undefined> {
    const ancestorIds: string[] = [];
    let currentDocument = await input.entityManager.findOne(
      DocumentEntity,
      input.documentId,
      { populate: ['parentDocument'] },
    );

    while (currentDocument?.parentDocument) {
      ancestorIds.push(currentDocument.parentDocument.id);
      currentDocument = await input.entityManager.findOne(
        DocumentEntity,
        currentDocument.parentDocument.id,
        { populate: ['parentDocument'] },
      );
    }

    if (ancestorIds.length === 0) {
      return undefined;
    }

    const grants = await input.entityManager.find(DocumentAccessGrantEntity, {
      document: { $in: ancestorIds },
      user: input.userId,
      revokedAt: null,
    });

    const rank: Record<DocumentAccessGrantPermission, number> = {
      [DocumentAccessGrantPermission.VIEW]: 1,
      [DocumentAccessGrantPermission.COMMENT]: 1,
      [DocumentAccessGrantPermission.EDIT]: 2,
      [DocumentAccessGrantPermission.MANAGE]: 3,
    };

    return grants.reduce<DocumentAccessGrantPermission | undefined>((strongest, grant) => {
      if (!strongest || rank[grant.permission] > rank[strongest]) {
        return grant.permission;
      }

      return strongest;
    }, undefined);
  }
}
