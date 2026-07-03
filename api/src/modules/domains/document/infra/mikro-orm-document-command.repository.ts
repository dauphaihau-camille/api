import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CurrentUserEntity } from '../../auth/infra/persistence/entities/current-user.entity';
import { TeamspaceEntity } from '../../teamspace/infra/persistence/entities/teamspace.entity';
import {
  DocumentCommandRepository,
  type DocumentCommandTransaction,
} from '../app/ports/document-command.repository';
import { MikroOrmDocumentSubdocReferenceRepository } from './mikro-orm-document-subdoc-reference.repository';
import { DocumentEntity } from './persistence/entities/document.entity';

@Injectable()
export class MikroOrmDocumentCommandRepository implements DocumentCommandRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findDocument(documentIdentifier: string): Promise<DocumentEntity | null> {
    return this.entityManager.findOne(DocumentEntity, {
      $or: [{ id: documentIdentifier }, { publicId: documentIdentifier }],
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'createdBy', 'updatedBy'],
    });
  }

  async findCurrentUser(userId: string): Promise<CurrentUserEntity> {
    return this.entityManager.findOneOrFail(CurrentUserEntity, { id: userId });
  }

  async findTeamspaceByIdInWorkspace(teamspaceId: string, workspaceId: string): Promise<TeamspaceEntity | null> {
    return this.entityManager.findOne(TeamspaceEntity, {
      id: teamspaceId,
      workspace: workspaceId,
    });
  }

  createDocument(payload: Record<string, unknown>): DocumentEntity {
    return this.entityManager.create(DocumentEntity, payload as never);
  }

  async saveDocument(document: DocumentEntity): Promise<void> {
    await this.entityManager.persist(document).flush();
  }

  async saveDocuments(documents: DocumentEntity[]): Promise<void> {
    await this.entityManager.persist(documents).flush();
  }

  async flush(): Promise<void> {
    await this.entityManager.flush();
  }

  async lockDocumentVersion(document: DocumentEntity, version: number): Promise<void> {
    await this.entityManager.lock(document, LockMode.OPTIMISTIC, version);
  }

  async withTransaction<T>(callback: (repositories: DocumentCommandTransaction) => Promise<T>): Promise<T> {
    return this.entityManager.transactional(async (transactionalEntityManager) =>
      callback({
        commandRepository: new MikroOrmDocumentCommandRepository(transactionalEntityManager),
        subdocReferenceRepository: new MikroOrmDocumentSubdocReferenceRepository(transactionalEntityManager),
      }));
  }
}
