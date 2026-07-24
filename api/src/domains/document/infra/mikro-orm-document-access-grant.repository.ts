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
  type InheritedDocumentAccessGrantSummary,
} from '../app/ports/document-access-grant.repository';
import { DocumentAccessGrantEntity } from './persistence/entities/document-access-grant.entity';
import { DocumentEntity } from './persistence/entities/document.entity';

type AncestorDocumentGrantSource = {
  depth: number;
  id: string;
  title: string;
};

const MAX_DOCUMENT_ANCESTOR_DEPTH = 100;

const DOCUMENT_ACCESS_GRANT_PERMISSION_RANK: Record<DocumentAccessGrantPermission, number> = {
  [DocumentAccessGrantPermission.VIEW]: 1,
  [DocumentAccessGrantPermission.COMMENT]: 1,
  [DocumentAccessGrantPermission.EDIT]: 2,
  [DocumentAccessGrantPermission.MANAGE]: 3,
};

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

  async findStrongestActiveGrantInAncestors(input: {
    documentId: string;
    userId: string;
  }): Promise<DocumentAccessGrantSummary | null> {
    const entityManager = this.entityManager.fork();
    const ancestorIds = await this.findAncestorDocumentIds(input.documentId, entityManager);

    if (ancestorIds.length === 0) {
      return null;
    }

    const grants = await entityManager.find(
      DocumentAccessGrantEntity,
      {
        document: { $in: ancestorIds },
        user: input.userId,
        revokedAt: null,
      },
      {
        populate: ['document', 'user', 'grantedBy'],
      },
    );

    return this.findStrongestGrant(grants);
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

  async findStrongestActiveGrantPermissionsInAncestorsByDocumentId(input: {
    documentIds: string[];
    userId: string;
  }): Promise<Map<string, DocumentAccessGrantPermission>> {
    if (input.documentIds.length === 0) {
      return new Map();
    }

    const entityManager = this.entityManager.fork();

    const entries = await Promise.all(input.documentIds.map(async (documentId) => {
      const ancestorIds = await this.findAncestorDocumentIds(documentId, entityManager);

      if (ancestorIds.length === 0) {
        return undefined;
      }

      const grants = await entityManager.find(
        DocumentAccessGrantEntity,
        {
          document: { $in: ancestorIds },
          user: input.userId,
          revokedAt: null,
        },
        {
          populate: ['document', 'user', 'grantedBy'],
        },
      );

      const strongestGrant = this.findStrongestGrant(grants);

      return strongestGrant
        ? [documentId, strongestGrant.permission] as const
        : undefined;
    }));

    return new Map(entries.filter((entry): entry is [string, DocumentAccessGrantPermission] =>
      Boolean(entry)));
  }

  async hasActiveGrants(documentId: string): Promise<boolean> {
    const count = await this.entityManager.fork().count(DocumentAccessGrantEntity, {
      document: documentId,
      revokedAt: null,
    });

    return count > 0;
  }

  async hasActiveGrantsIncludingAncestors(documentId: string): Promise<boolean> {
    const entityManager = this.entityManager.fork();
    const ancestorIds = await this.findAncestorDocumentIds(documentId, entityManager);

    const count = await entityManager.count(DocumentAccessGrantEntity, {
      document: { $in: [documentId, ...ancestorIds] },
      revokedAt: null,
    });

    return count > 0;
  }

  async findDocumentIdsWithActiveGrantsIncludingAncestors(
    documentIds: string[],
  ): Promise<Set<string>> {
    if (documentIds.length === 0) {
      return new Set();
    }

    const entityManager = this.entityManager.fork();
    const entries = await Promise.all(documentIds.map(async (documentId) => {
      const ancestorIds = await this.findAncestorDocumentIds(documentId, entityManager);
      const count = await entityManager.count(DocumentAccessGrantEntity, {
        document: { $in: [documentId, ...ancestorIds] },
        revokedAt: null,
      });

      return count > 0 ? documentId : undefined;
    }));

    return new Set(entries.filter((documentId): documentId is string => Boolean(documentId)));
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

  async findUserById(userId: string): Promise<DocumentAccessGrantUserSummary | null> {
    const user = await this.entityManager.fork().findOne(CurrentUserEntity, {
      id: userId,
    });

    return user
      ? {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      }
      : null;
  }

  async findUserByEmail(email: string): Promise<DocumentAccessGrantUserSummary | null> {
    const user = await this.entityManager.fork().findOne(CurrentUserEntity, {
      email,
    });

    return user
      ? {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      }
      : null;
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

  async listStrongestActiveGrantsInAncestors(
    documentId: string,
  ): Promise<InheritedDocumentAccessGrantSummary[]> {
    const entityManager = this.entityManager.fork();
    const ancestorDocuments = await this.findAncestorDocuments(documentId, entityManager);

    if (ancestorDocuments.length === 0) {
      return [];
    }

    const ancestorOrderByDocumentId = new Map(
      ancestorDocuments.map((document) => [document.id, document.depth]),
    );

    const grants = await entityManager.find(
      DocumentAccessGrantEntity,
      {
        document: { $in: ancestorDocuments.map((document) => document.id) },
        revokedAt: null,
      },
      {
        populate: ['document', 'user', 'grantedBy'],
      },
    );

    const strongestByUserId = new Map<string, DocumentAccessGrantEntity>();

    for (const grant of grants) {
      const existingGrant = strongestByUserId.get(grant.user.id);

      if (
        !existingGrant
        || this.compareGrantStrength(grant, existingGrant, ancestorOrderByDocumentId) > 0
      ) {
        strongestByUserId.set(grant.user.id, grant);
      }
    }

    const strongestInheritedGrants = Array.from(strongestByUserId.values());
    
    return strongestInheritedGrants.map((grant) => {
      const summary = this.toSummary(grant);
    
      return {
        ...summary,
        inheritedFromDocument: {
          id: grant.document.id,
          title: grant.document.title,
        },
      };
    });
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

  private async findAncestorDocumentIds(
    documentId: string,
    entityManager: EntityManager,
  ): Promise<string[]> {
    return (await this.findAncestorDocuments(documentId, entityManager)).map((document) => document.id);
  }

  private async findAncestorDocuments(
    documentId: string,
    entityManager: EntityManager,
  ): Promise<AncestorDocumentGrantSource[]> {
    return entityManager.getConnection().execute<AncestorDocumentGrantSource[]>(
      `
        with recursive ancestors as (
          select
            parent.id,
            parent.title,
            parent.parent_document_id,
            0 as depth,
            array[child.id, parent.id] as path
          from documents child
          join documents parent on parent.id = child.parent_document_id
          where child.id = ?

          union all

          select
            parent.id,
            parent.title,
            parent.parent_document_id,
            ancestors.depth + 1 as depth,
            ancestors.path || parent.id
          from ancestors
          join documents parent on parent.id = ancestors.parent_document_id
          where
            not parent.id = any(ancestors.path)
            and ancestors.depth < ?
        )
        select
          id,
          title,
          depth
        from ancestors
        order by depth asc
      `,
      [documentId, MAX_DOCUMENT_ANCESTOR_DEPTH],
    );
  }

  private findStrongestGrant(
    grants: DocumentAccessGrantEntity[],
  ): DocumentAccessGrantSummary | null {
    const strongestGrant = grants.reduce<DocumentAccessGrantEntity | undefined>((strongest, grant) => {
      if (
        !strongest
        || DOCUMENT_ACCESS_GRANT_PERMISSION_RANK[grant.permission] >
          DOCUMENT_ACCESS_GRANT_PERMISSION_RANK[strongest.permission]
      ) {
        return grant;
      }

      return strongest;
    }, undefined);

    return strongestGrant ? this.toSummary(strongestGrant) : null;
  }

  private compareGrantStrength(
    candidate: DocumentAccessGrantEntity,
    current: DocumentAccessGrantEntity,
    ancestorOrderByDocumentId: Map<string, number>,
  ): number {
    const permissionDifference =
      DOCUMENT_ACCESS_GRANT_PERMISSION_RANK[candidate.permission] -
      DOCUMENT_ACCESS_GRANT_PERMISSION_RANK[current.permission];

    if (permissionDifference !== 0) {
      return permissionDifference;
    }

    const candidateAncestorOrder = ancestorOrderByDocumentId.get(candidate.document.id) ?? Number.MAX_SAFE_INTEGER;
    const currentAncestorOrder = ancestorOrderByDocumentId.get(current.document.id) ?? Number.MAX_SAFE_INTEGER;

    return currentAncestorOrder - candidateAncestorOrder;
  }
}
