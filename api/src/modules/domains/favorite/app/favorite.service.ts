import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { CurrentUserEntity } from '~/modules/domains/auth/infra/persistence/entities/current-user.entity';
import { DocumentEntity } from '~/modules/domains/document/infra/persistence/entities/document.entity';
import { AuditService } from '~/modules/shared/audit/audit.service';
import { WorkspaceRepository } from '../../workspace/app/workspace.repository';
import type {
  FavoriteDocumentSummary,
  FavoriteStatusSummary,
} from './favorite.types';
import { DocumentFavoriteEntity } from '../infra/persistence/entities/document-favorite.entity';
import {
  FavoriteDocumentNotFoundError,
  FavoriteWorkspaceNotFoundError,
} from './errors/favorite-app.error';

@Injectable()
export class FavoriteService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly auditService: AuditService,
  ) {}

  async listForWorkspace(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ): Promise<FavoriteDocumentSummary[]> {
    const workspace = await this.resolveWorkspaceForUser(workspaceIdentifier, currentUser);
    const favorites = await this.entityManager.fork().find(DocumentFavoriteEntity, {
      workspace: workspace.id,
      user: currentUser.userId,
      document: {
        archivedAt: null,
      },
    }, {
      populate: ['document', 'document.teamspace', 'document.parentDocument'],
      orderBy: {
        createdAt: 'desc',
      },
    });

    return favorites.map((favorite) => this.toSummary(favorite));
  }

  async getStatusForDocument(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<FavoriteStatusSummary> {
    const entityManager = this.entityManager.fork();
    const document = await this.findDocumentOrThrow(documentId, entityManager);

    await this.resolveWorkspaceForUser(document.workspace.id, currentUser);

    const favorite = await entityManager.findOne(DocumentFavoriteEntity, {
      document: document.id,
      user: currentUser.userId,
    });

    return {
      documentId,
      isFavorite: Boolean(favorite),
    };
  }

  async addForDocument(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<FavoriteStatusSummary> {
    const entityManager = this.entityManager.fork();
    const document = await this.findDocumentOrThrow(documentId, entityManager);
    await this.resolveWorkspaceForUser(document.workspace.id, currentUser);

    let favorite = await entityManager.findOne(DocumentFavoriteEntity, {
      document: document.id,
      user: currentUser.userId,
    });

    if (!favorite) {
      const user = await entityManager.findOneOrFail(CurrentUserEntity, { id: currentUser.userId });
      favorite = entityManager.create(DocumentFavoriteEntity, {
        workspace: document.workspace,
        document,
        user,
      });
      await entityManager.persist(favorite).flush();

      await this.auditService.record({
        action: 'document.favorited',
        resourceType: 'document',
        resourceId: document.id,
        metadata: {
          workspaceId: document.workspace.id,
        },
      });
    }

    return {
      documentId,
      isFavorite: true,
    };
  }

  async removeForDocument(
    documentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<FavoriteStatusSummary> {
    const entityManager = this.entityManager.fork();
    const document = await this.findDocumentOrThrow(documentId, entityManager);
    await this.resolveWorkspaceForUser(document.workspace.id, currentUser);

    const favorite = await entityManager.findOne(DocumentFavoriteEntity, {
      document: document.id,
      user: currentUser.userId,
    });

    if (favorite) {
      await entityManager.remove(favorite).flush();

      await this.auditService.record({
        action: 'document.unfavorited',
        resourceType: 'document',
        resourceId: document.id,
        metadata: {
          workspaceId: document.workspace.id,
        },
      });
    }

    return {
      documentId,
      isFavorite: false,
    };
  }

  private async findDocumentOrThrow(
    documentId: string,
    entityManager: EntityManager,
  ): Promise<DocumentEntity> {
    const document = await entityManager.findOne(DocumentEntity, {
      id: documentId,
      archivedAt: null,
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument'],
    });

    if (!document) {
      throw new FavoriteDocumentNotFoundError(documentId);
    }

    return document;
  }

  private async resolveWorkspaceForUser(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
  ) {
    const workspaces = await this.workspaceRepository.findAllForUser(currentUser.userId);
    const normalizedIdentifier = workspaceIdentifier.trim().toLowerCase();
    const workspace = workspaces.find((item) =>
      item.id === workspaceIdentifier || item.slug === normalizedIdentifier,
    );

    if (!workspace) {
      throw new FavoriteWorkspaceNotFoundError(workspaceIdentifier);
    }

    return workspace;
  }

  private toSummary(favorite: DocumentFavoriteEntity): FavoriteDocumentSummary {
    return {
      documentId: favorite.document.id,
      publicId: favorite.document.publicId,
      workspaceId: favorite.workspace.id,
      teamspaceId: favorite.document.teamspace?.id,
      parentDocumentId: favorite.document.parentDocument?.id,
      title: favorite.document.title,
      sortKey: favorite.document.sortKey,
      favoritedAt: favorite.createdAt,
    };
  }
}
