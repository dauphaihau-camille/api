import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Scope } from '@nestjs/common';
import { CurrentUserEntity } from '../../auth/infra/persistence/entities/current-user.entity';
import { TeamspaceEntity } from '../../teamspace/infra/persistence/entities/teamspace.entity';
import {
  DocumentCommandRepository,
  type CreateDocumentRecordInput,
  type DocumentCommandTransaction,
} from '../app/ports/document-command.repository';
import { DocumentSubdocContentService } from '../app/services/document-subdoc-content.service';
import { MikroOrmDocumentCollaborationRepository } from './mikro-orm-document-collaboration.repository';
import { MikroOrmDocumentSubdocReferenceRepository } from './mikro-orm-document-subdoc-reference.repository';
import { DocumentEntity } from './persistence/entities/document.entity';
import { WorkspaceEntity } from '../../workspace/infra/persistence/entities/workspace.entity';

@Injectable({ scope: Scope.REQUEST })
export class MikroOrmDocumentCommandRepository implements DocumentCommandRepository {
  private readonly scopedEntityManager: EntityManager;

  constructor(
    private readonly entityManager: EntityManager,
    private readonly documentSubdocContentService: DocumentSubdocContentService,
  ) {
    this.scopedEntityManager = entityManager.global ? entityManager.fork() : entityManager;
  }

  async findDocument(documentIdentifier: string): Promise<DocumentEntity | null> {
    return this.scopedEntityManager.findOne(DocumentEntity, {
      $or: [{ id: documentIdentifier }, { publicId: documentIdentifier }],
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'createdBy', 'updatedBy'],
    });
  }

  async findTeamspaceByIdInWorkspace(teamspaceId: string, workspaceId: string) {
    const teamspace = await this.scopedEntityManager.findOne(TeamspaceEntity, {
      id: teamspaceId,
      workspace: workspaceId,
    });

    if (!teamspace) {
      return null;
    }

    return {
      id: teamspace.id,
      name: teamspace.name,
      description: teamspace.description,
    };
  }

  createDocument(input: CreateDocumentRecordInput): DocumentEntity {
    return this.scopedEntityManager.create(DocumentEntity, {
      workspace: this.scopedEntityManager.getReference(WorkspaceEntity, input.workspaceId),
      teamspace: input.teamspaceId
        ? this.scopedEntityManager.getReference(TeamspaceEntity, input.teamspaceId)
        : undefined,
      parentDocument: input.parentDocumentId
        ? this.scopedEntityManager.getReference(DocumentEntity, input.parentDocumentId)
        : undefined,
      title: input.title,
      contentFormat: input.contentFormat,
      contentJson: input.contentJson,
      searchText: input.searchText,
      sortKey: input.sortKey,
      createdBy: this.scopedEntityManager.getReference(CurrentUserEntity, input.createdByUserId),
      updatedBy: this.scopedEntityManager.getReference(CurrentUserEntity, input.updatedByUserId),
    });
  }

  assignUpdatedByUser(document: DocumentEntity, userId: string): void {
    document.updatedBy = this.scopedEntityManager.getReference(CurrentUserEntity, userId);
  }

  async saveDocument(document: DocumentEntity): Promise<void> {
    await this.scopedEntityManager.persist(document).flush();
  }

  async saveDocuments(documents: DocumentEntity[]): Promise<void> {
    await this.scopedEntityManager.persist(documents).flush();
  }

  async removeDocuments(documents: DocumentEntity[]): Promise<void> {
    await this.scopedEntityManager.remove(documents).flush();
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
        commandRepository: new MikroOrmDocumentCommandRepository(
          transactionalEntityManager,
          this.documentSubdocContentService,
        ),
        collaborationRepository: new MikroOrmDocumentCollaborationRepository(
          transactionalEntityManager,
        ),
        subdocReferenceRepository: new MikroOrmDocumentSubdocReferenceRepository(transactionalEntityManager),
      }));
  }
}
