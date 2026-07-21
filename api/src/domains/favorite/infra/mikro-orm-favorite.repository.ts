import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { CurrentUserEntity } from '~/domains/auth/infra/persistence/entities/current-user.entity';
import { DocumentEntity } from '~/domains/document/infra/persistence/entities/document.entity';
import { FavoriteRepository } from '../app/ports/favorite.repository';
import { DocumentFavoriteEntity } from './persistence/entities/document-favorite.entity';

@Injectable()
export class MikroOrmFavoriteRepository implements FavoriteRepository {
  constructor(private readonly entityManager: EntityManager) {}

  findFavoritesForWorkspace(input: {
    workspaceId: string;
    userId: string;
  }): Promise<DocumentFavoriteEntity[]> {
    return this.entityManager.fork().find(DocumentFavoriteEntity, {
      workspace: input.workspaceId,
      user: input.userId,
      document: {
        archivedAt: null,
      },
    }, {
      populate: ['document', 'document.teamspace', 'document.parentDocument', 'document.ownerUser'],
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findActiveDocumentById(documentId: string): Promise<DocumentEntity | null> {
    return this.entityManager.fork().findOne(DocumentEntity, {
      id: documentId,
      archivedAt: null,
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'ownerUser'],
    });
  }

  findFavorite(input: {
    documentId: string;
    userId: string;
  }): Promise<DocumentFavoriteEntity | null> {
    return this.entityManager.fork().findOne(DocumentFavoriteEntity, {
      document: input.documentId,
      user: input.userId,
    });
  }

  async createFavorite(input: {
    workspaceId: string;
    documentId: string;
    userId: string;
  }): Promise<DocumentFavoriteEntity> {
    const entityManager = this.entityManager.fork();
    const user = await entityManager.findOneOrFail(CurrentUserEntity, { id: input.userId });
    const document = await entityManager.getReference(DocumentEntity, input.documentId);

    return entityManager.create(DocumentFavoriteEntity, {
      workspace: input.workspaceId,
      document,
      user,
    });
  }

  async saveFavorite(favorite: DocumentFavoriteEntity): Promise<void> {
    await this.entityManager.fork().persist(favorite).flush();
  }

  async removeFavorite(favorite: DocumentFavoriteEntity): Promise<void> {
    await this.entityManager.fork().remove(favorite).flush();
  }
}
