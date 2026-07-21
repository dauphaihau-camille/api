import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { DocumentFavoriteEntity } from '../../favorite/infra/persistence/entities/document-favorite.entity';
import { TeamspaceEntity } from '../../teamspace/infra/persistence/entities/teamspace.entity';
import type {
  DocumentBreadcrumbItem,
  DocumentTeamspaceRef,
} from '../app/contracts/document.contract';
import { DocumentNavigationQueryRepository } from '../app/ports/document-navigation-query.repository';
import { DocumentEntity } from './persistence/entities/document.entity';

@Injectable()
export class MikroOrmDocumentNavigationQueryRepository implements DocumentNavigationQueryRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findDocument(documentIdentifier: string): Promise<DocumentEntity | null> {
    return this.entityManager.fork().findOne(DocumentEntity, {
      $or: [{ id: documentIdentifier }, { publicId: documentIdentifier }],
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'createdBy', 'ownerUser', 'updatedBy'],
    });
  }

  async findDocumentByIdInWorkspace(input: {
    documentId: string;
    workspaceId: string;
    archivedAt?: null;
  }): Promise<DocumentEntity | null> {
    return this.entityManager.fork().findOne(DocumentEntity, {
      id: input.documentId,
      workspace: input.workspaceId,
      ...(input.archivedAt === null ? { archivedAt: null } : {}),
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'ownerUser'],
    });
  }

  async findTeamspaces(workspaceId: string): Promise<DocumentTeamspaceRef[]> {
    const teamspaces = await this.entityManager.fork().find(TeamspaceEntity, { workspace: workspaceId }, {
      orderBy: { name: 'asc' },
    });

    return teamspaces.map((teamspace) => ({
      id: teamspace.id,
      name: teamspace.name,
      description: teamspace.description,
    }));
  }

  async findRootDocuments(input: {
    workspaceId: string;
    teamspaceId?: string | null;
    parentDocumentId?: string | null;
    query?: string;
  }): Promise<DocumentEntity[]> {
    return this.entityManager.fork().find(DocumentEntity, {
      workspace: input.workspaceId,
      teamspace: input.teamspaceId ?? null,
      parentDocument: input.parentDocumentId ?? null,
      archivedAt: null,
      ...(input.query?.trim()
        ? {
          title: {
            $ilike: `%${input.query.trim()}%`,
          },
        }
        : {}),
    }, {
      populate: ['teamspace', 'parentDocument', 'ownerUser'],
      orderBy: { sortKey: 'asc', id: 'asc' },
    });
  }

  async findArchivedDocuments(input: {
    workspaceId: string;
    query?: string;
  }): Promise<DocumentEntity[]> {
    return this.entityManager.fork().find(DocumentEntity, {
      workspace: input.workspaceId,
      archivedAt: { $ne: null },
      ...(input.query?.trim()
        ? {
          title: {
            $ilike: `%${input.query.trim()}%`,
          },
        }
        : {}),
    }, {
      populate: ['teamspace', 'parentDocument', 'ownerUser'],
      orderBy: { archivedAt: 'desc', id: 'desc' },
    });
  }

  async findAncestors(parentDocumentId?: string): Promise<DocumentBreadcrumbItem[]> {
    if (!parentDocumentId) {
      return [];
    }

    const entityManager = this.entityManager.fork();
    const cache = new Map<string, DocumentEntity | null>();
    const ancestors: DocumentBreadcrumbItem[] = [];
    let currentParentDocumentId: string | undefined = parentDocumentId;

    while (currentParentDocumentId) {
      const ancestor = await this.findDocumentById(
        currentParentDocumentId,
        entityManager,
        cache,
      );

      if (!ancestor) {
        break;
      }

      ancestors.push({
        id: ancestor.id,
        publicId: ancestor.publicId,
        title: ancestor.title,
      });
      currentParentDocumentId = ancestor.parentDocument?.id;
    }

    return ancestors.reverse();
  }

  async findChildren(input: { workspaceId: string; parentDocumentId: string }): Promise<DocumentEntity[]> {
    return this.entityManager.fork().find(DocumentEntity, {
      workspace: input.workspaceId,
      parentDocument: input.parentDocumentId,
      archivedAt: null,
    }, {
      populate: ['teamspace', 'parentDocument', 'ownerUser'],
      orderBy: { sortKey: 'asc', createdAt: 'asc' },
    });
  }

  async countActiveChildren(workspaceId: string, parentDocumentId: string): Promise<number> {
    return this.entityManager.fork().count(DocumentEntity, {
      workspace: workspaceId,
      parentDocument: parentDocumentId,
      archivedAt: null,
    });
  }

  async findFavoriteDocumentIds(input: {
    workspaceId: string;
    userId: string;
    documentIds: string[];
  }): Promise<string[]> {
    if (input.documentIds.length === 0) {
      return [];
    }

    const favorites = await this.entityManager.fork().find(
      DocumentFavoriteEntity,
      {
        workspace: input.workspaceId,
        user: input.userId,
        document: { $in: input.documentIds },
      },
      {
        populate: ['document'],
      },
    );

    return favorites.map((favorite) => favorite.document.id);
  }

  private async findDocumentById(
    documentId: string,
    entityManager: EntityManager,
    cache: Map<string, DocumentEntity | null>,
  ): Promise<DocumentEntity | null> {
    if (cache.has(documentId)) {
      return cache.get(documentId) ?? null;
    }

    const document = await entityManager.findOne(DocumentEntity, {
      id: documentId,
    }, {
      populate: ['parentDocument'],
    });

    cache.set(documentId, document ?? null);

    return document;
  }
}
