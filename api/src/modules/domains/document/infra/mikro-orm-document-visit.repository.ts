import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CurrentUserEntity } from '../../auth/infra/persistence/entities/current-user.entity';
import { DocumentVisitRepository } from '../app/ports/document-visit.repository';
import { DocumentEntity } from './persistence/entities/document.entity';
import { DocumentVisitEntity } from './persistence/entities/document-visit.entity';

@Injectable()
export class MikroOrmDocumentVisitRepository implements DocumentVisitRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async findRecentVisit(input: { workspaceId: string; userId: string }): Promise<{ document: DocumentEntity } | null> {
    return this.entityManager.fork().findOne(DocumentVisitEntity, {
      workspace: input.workspaceId,
      user: input.userId,
      document: { archivedAt: null },
    }, {
      populate: ['document'],
      orderBy: { lastVisitedAt: 'desc' },
    });
  }

  async recordVisit(document: DocumentEntity, userId: string): Promise<void> {
    const entityManager = this.entityManager.fork();
    const [user, existingVisit] = await Promise.all([
      entityManager.findOneOrFail(CurrentUserEntity, { id: userId }),
      entityManager.findOne(DocumentVisitEntity, {
        user: userId,
        document: document.id,
      }),
    ]);

    const visit = existingVisit ?? entityManager.create(DocumentVisitEntity, {
      workspace: document.workspace,
      document,
      user,
      lastVisitedAt: new Date(),
    });

    visit.workspace = document.workspace;
    visit.document = document;
    visit.user = user;
    visit.lastVisitedAt = new Date();

    await entityManager.persist(visit).flush();
  }
}
