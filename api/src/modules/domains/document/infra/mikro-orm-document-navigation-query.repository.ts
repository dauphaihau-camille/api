import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { TeamspaceEntity } from '../../teamspace/infra/persistence/entities/teamspace.entity';
import { DocumentNavigationQueryRepository } from '../app/ports/document-navigation-query.repository';
import { DocumentEntity } from './persistence/entities/document.entity';

@Injectable()
export class MikroOrmDocumentNavigationQueryRepository implements DocumentNavigationQueryRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findDocument(documentIdentifier: string): Promise<DocumentEntity | null> {
    return this.entityManager.fork().findOne(DocumentEntity, {
      $or: [{ id: documentIdentifier }, { publicId: documentIdentifier }],
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'createdBy', 'updatedBy'],
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
    });
  }

  async findTeamspaces(workspaceId: string): Promise<TeamspaceEntity[]> {
    return this.entityManager.fork().find(TeamspaceEntity, { workspace: workspaceId }, {
      orderBy: { name: 'asc' },
    });
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
      populate: ['teamspace', 'parentDocument'],
      orderBy: { sortKey: 'asc', id: 'asc' },
    });
  }

  async findChildren(input: { workspaceId: string; parentDocumentId: string }): Promise<DocumentEntity[]> {
    return this.entityManager.fork().find(DocumentEntity, {
      workspace: input.workspaceId,
      parentDocument: input.parentDocumentId,
      archivedAt: null,
    }, {
      populate: ['teamspace', 'parentDocument'],
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
}
