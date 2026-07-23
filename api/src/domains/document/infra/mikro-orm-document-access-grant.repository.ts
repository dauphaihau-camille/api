import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CurrentUserEntity } from '~/domains/auth/infra/persistence/entities/current-user.entity';
import { WorkspaceMemberEntity } from '~/domains/workspace/infra/persistence/entities/workspace-member.entity';
import { WorkspaceEntity } from '~/domains/workspace/infra/persistence/entities/workspace.entity';
import { DocumentAccessGrantPermission } from '../domain/enums/document-access-grant-permission.enum';
import {
  DocumentAccessGrantRepository,
  type DocumentAccessGrantSummary,
  type DocumentAccessGrantUserSummary,
} from '../app/ports/document-access-grant.repository';
import { DocumentAccessGrantEntity } from './persistence/entities/document-access-grant.entity';
import { DocumentEntity } from './persistence/entities/document.entity';

@Injectable()
export class MikroOrmDocumentAccessGrantRepository extends DocumentAccessGrantRepository {
  constructor(private readonly entityManager: EntityManager) {
    super();
  }

  async findActiveGrant(input: {
    documentId: string;
    userId: string;
  }): Promise<DocumentAccessGrantSummary | null> {
    const grant = await this.entityManager.fork().findOne(
      DocumentAccessGrantEntity,
      {
        document: input.documentId,
        user: input.userId,
        revokedAt: null,
      },
      {
        populate: ['document', 'user', 'grantedBy'],
      },
    );

    return grant ? this.toSummary(grant) : null;
  }

  async findActiveGrantPermissionsByDocumentId(input: {
    documentIds: string[];
    userId: string;
  }): Promise<Map<string, DocumentAccessGrantPermission>> {
    if (input.documentIds.length === 0) {
      return new Map();
    }

    const grants = await this.entityManager.fork().find(
      DocumentAccessGrantEntity,
      {
        document: { $in: input.documentIds },
        user: input.userId,
        revokedAt: null,
      },
      {
        populate: ['document'],
      },
    );

    return new Map(grants.map((grant) => [grant.document.id, grant.permission]));
  }

  async hasActiveGrants(documentId: string): Promise<boolean> {
    const count = await this.entityManager.fork().count(DocumentAccessGrantEntity, {
      document: documentId,
      revokedAt: null,
    });

    return count > 0;
  }

  async findWorkspaceUser(input: {
    workspaceId: string;
    userId: string;
  }): Promise<DocumentAccessGrantUserSummary | null> {
    const membership = await this.entityManager.fork().findOne(
      WorkspaceMemberEntity,
      {
        workspace: input.workspaceId,
        user: input.userId,
      },
      {
        populate: ['user'],
      },
    );

    if (!membership) {
      return null;
    }

    return {
      id: membership.user.id,
      email: membership.user.email,
      displayName: membership.user.displayName,
    };
  }

  async upsertGrant(input: {
    workspaceId: string;
    documentId: string;
    userId: string;
    permission: DocumentAccessGrantPermission;
    grantedByUserId: string;
  }): Promise<DocumentAccessGrantSummary> {
    const entityManager = this.entityManager.fork();
    const grantRepository = entityManager.getRepository(DocumentAccessGrantEntity);
    const existingGrant = await grantRepository.findOne(
      {
        document: input.documentId,
        user: input.userId,
      },
      {
        populate: ['document', 'user', 'grantedBy'],
      },
    );

    if (existingGrant) {
      existingGrant.permission = input.permission;
      existingGrant.grantedBy = entityManager.getReference(CurrentUserEntity, input.grantedByUserId);
      existingGrant.revokedAt = undefined;
      await entityManager.persist(existingGrant).flush();
      await entityManager.populate(existingGrant, ['document', 'user', 'grantedBy']);

      return this.toSummary(existingGrant);
    }

    const grant = grantRepository.create({
      workspace: entityManager.getReference(WorkspaceEntity, input.workspaceId),
      document: entityManager.getReference(DocumentEntity, input.documentId),
      user: entityManager.getReference(CurrentUserEntity, input.userId),
      permission: input.permission,
      grantedBy: entityManager.getReference(CurrentUserEntity, input.grantedByUserId),
    });

    await entityManager.persist(grant).flush();
    await entityManager.populate(grant, ['document', 'user', 'grantedBy']);

    return this.toSummary(grant);
  }

  async revokeGrant(input: {
    documentId: string;
    userId: string;
  }): Promise<DocumentAccessGrantSummary | null> {
    const entityManager = this.entityManager.fork();

    const grant = await entityManager.findOne(
      DocumentAccessGrantEntity,
      {
        document: input.documentId,
        user: input.userId,
        revokedAt: null,
      },
      {
        populate: ['document', 'user', 'grantedBy'],
      },
    );

    if (!grant) {
      return null;
    }

    grant.revokedAt = new Date();
    await entityManager.persist(grant).flush();

    return this.toSummary(grant);
  }

  async listActiveGrants(documentId: string): Promise<DocumentAccessGrantSummary[]> {
    const grants = await this.entityManager.fork().find(
      DocumentAccessGrantEntity,
      {
        document: documentId,
        revokedAt: null,
      },
      {
        populate: ['document', 'user', 'grantedBy'],
        orderBy: { createdAt: 'asc', id: 'asc' },
      },
    );

    return grants.map((grant) => this.toSummary(grant));
  }

  private toSummary(grant: DocumentAccessGrantEntity): DocumentAccessGrantSummary {
    return {
      id: grant.id,
      documentId: grant.document.id,
      user: {
        id: grant.user.id,
        email: grant.user.email,
        displayName: grant.user.displayName,
      },
      permission: grant.permission,
      grantedByUserId: grant.grantedBy.id,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
    };
  }
}
