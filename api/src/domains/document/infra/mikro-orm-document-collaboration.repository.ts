import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { WorkspaceMemberEntity } from '../../workspace/infra/persistence/entities/workspace-member.entity';
import type {
  DocumentCollaborationAccess,
  PersistedDocumentCollaborationState,
} from '../app/ports/document-collaboration.repository';
import { DocumentCollaborationRepository } from '../app/ports/document-collaboration.repository';
import { extractDocumentSearchText } from '../app/utils/document-search-text.util';
import { DocumentCollaborationSnapshotEntity } from './persistence/entities/document-collaboration-snapshot.entity';
import { DocumentCollaborationUpdateEntity } from './persistence/entities/document-collaboration-update.entity';
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

    return {
      content: document.contentJson,
      title: document.title,
      documentOwnerUserId: document.ownerUser.id,
      documentTeamspaceId: document.teamspace?.id,
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
  ): Promise<void> {
    const entityManager = this.entityManager.fork();

    await entityManager.transactional(async (transactionalEntityManager) => {
      const snapshot = await transactionalEntityManager.findOneOrFail(
        DocumentCollaborationSnapshotEntity,
        { document: documentId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );

      if (snapshot.projectionSequence >= sequence) {
        return;
      }

      const document = await transactionalEntityManager.findOneOrFail(
        DocumentEntity,
        documentId,
        { populate: ['workspace'] },
      );
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

      await transactionalEntityManager.getConnection().execute(
        `update "documents"
         set "title" = ?, "content_json" = cast(? as jsonb), "search_text" = ?, "updated_by" = ?, "updated_at" = now()
         where "id" = ?`,
        [
          title,
          JSON.stringify(content),
          extractDocumentSearchText(content),
          updatedByUserId,
          documentId,
        ],
      );
      snapshot.projectionSequence = sequence;
      await transactionalEntityManager.flush();
    });
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
}
