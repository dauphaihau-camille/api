import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Scope } from '@nestjs/common';
import { CurrentUserEntity } from '../../auth/infra/persistence/entities/current-user.entity';
import { TeamspaceEntity } from '../../teamspace/infra/persistence/entities/teamspace.entity';
import {
  DocumentCommandRepository,
  type DocumentCommandTransaction,
} from '../app/ports/document-command.repository';
import { MikroOrmDocumentSubdocReferenceRepository } from './mikro-orm-document-subdoc-reference.repository';
import { DocumentEntity } from './persistence/entities/document.entity';

@Injectable({ scope: Scope.REQUEST })
export class MikroOrmDocumentCommandRepository implements DocumentCommandRepository {
  private readonly scopedEntityManager: EntityManager;

  constructor(private readonly entityManager: EntityManager) {
    this.scopedEntityManager = entityManager.global ? entityManager.fork() : entityManager;
  }

  async findDocument(documentIdentifier: string): Promise<DocumentEntity | null> {
    return this.scopedEntityManager.findOne(DocumentEntity, {
      $or: [{ id: documentIdentifier }, { publicId: documentIdentifier }],
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'createdBy', 'updatedBy'],
    });
  }

  async findCurrentUser(userId: string): Promise<CurrentUserEntity> {
    return this.scopedEntityManager.findOneOrFail(CurrentUserEntity, { id: userId });
  }

  async findTeamspaceByIdInWorkspace(teamspaceId: string, workspaceId: string): Promise<TeamspaceEntity | null> {
    return this.scopedEntityManager.findOne(TeamspaceEntity, {
      id: teamspaceId,
      workspace: workspaceId,
    });
  }

  createDocument(payload: Record<string, unknown>): DocumentEntity {
    return this.scopedEntityManager.create(DocumentEntity, payload as never);
  }

  async saveDocument(document: DocumentEntity): Promise<void> {
    await this.scopedEntityManager.persist(document).flush();
  }

  async saveDocuments(documents: DocumentEntity[]): Promise<void> {
    await this.scopedEntityManager.persist(documents).flush();
  }

  async flush(): Promise<void> {
    await this.scopedEntityManager.flush();
  }

  async lockDocumentVersion(document: DocumentEntity, version: number): Promise<void> {
    await this.scopedEntityManager.lock(document, LockMode.OPTIMISTIC, version);
  }

  async withTransaction<T>(callback: (repositories: DocumentCommandTransaction) => Promise<T>): Promise<T> {
    return this.scopedEntityManager.transactional(async (transactionalEntityManager) =>
      callback({
        commandRepository: new MikroOrmDocumentCommandRepository(transactionalEntityManager),
        subdocReferenceRepository: new MikroOrmDocumentSubdocReferenceRepository(transactionalEntityManager),
      }));
  }
}
