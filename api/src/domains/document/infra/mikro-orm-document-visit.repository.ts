import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { UserEntity } from '../../user/infra/persistence/entities/user.entity';
import { DocumentVisitRepository } from '../app/ports/document-visit.repository';
import { DocumentEntity } from './persistence/entities/document.entity';
import { WorkspaceEntity } from '../../workspace/infra/persistence/entities/workspace.entity';
import { DocumentVisitEntity } from './persistence/entities/document-visit.entity';

@Injectable()
export class MikroOrmDocumentVisitRepository implements DocumentVisitRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findRecentVisit(input: { workspaceId: string; userId: string }): Promise<{ documentId: string } | null> {
    const visit = await this.entityManager.fork().findOne(DocumentVisitEntity, {
      workspace: input.workspaceId,
      user: input.userId,
      document: { archivedAt: null },
    }, {
      populate: ['document'],
      orderBy: { lastVisitedAt: 'desc' },
    });

    return visit ? { documentId: visit.document.id } : null;
  }

  async recordVisit(input: {
    documentId: string;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    const entityManager = this.entityManager.fork();
    const [user, existingVisit] = await Promise.all([
      entityManager.findOneOrFail(UserEntity, { id: input.userId }),
      entityManager.findOne(DocumentVisitEntity, {
        user: input.userId,
        document: input.documentId,
      }),
    ]);
    const document = entityManager.getReference(DocumentEntity, input.documentId);
    const workspace = entityManager.getReference(WorkspaceEntity, input.workspaceId);

    const visit = existingVisit ?? entityManager.create(DocumentVisitEntity, {
      workspace,
      document,
      user,
      lastVisitedAt: new Date(),
    });

    visit.workspace = workspace;
    visit.document = document;
    visit.user = user;
    visit.lastVisitedAt = new Date();

    await entityManager.persist(visit).flush();
  }
}
