import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { DocumentFavoriteEntity } from '~/domains/favorite/infra/persistence/entities/document-favorite.entity';
import { PublishedDocumentEntity } from '~/domains/publish/infra/persistence/entities/published-document.entity';
import { WorkspaceMemberEntity } from '~/domains/workspace/infra/persistence/entities/workspace-member.entity';
import type {
  DocumentBreadcrumbItem,
  DocumentSummary,
} from '../app/contracts/document.contract';
import { toDocumentSummary } from '../app/mappers/document-summary.mapper';
import {
  type AiSourceDocument,
  DocumentDetailQueryRepository,
} from '../app/ports/document-detail-query.repository';
import { DocumentAccessResolver } from '../app/policies/document-access.resolver';
import { DocumentAccessGrantPermission } from '../domain/enums/document-access-grant-permission.enum';
import { DocumentAccessGrantEntity } from './persistence/entities/document-access-grant.entity';
import { DocumentAccessSettingEntity } from './persistence/entities/document-access-setting.entity';
import { DocumentEntity } from './persistence/entities/document.entity';

type AncestorDocumentRow = {
  depth: number;
  id: string;
  publicId: string;
  title: string;
};

type BatchAncestorDocumentRow = AncestorDocumentRow & {
  documentId: string;
};

type ActiveGrantCountRow = {
  documentId: string;
  activeGrantCount: number | string;
};

const MAX_DOCUMENT_ANCESTOR_DEPTH = 100;

const DOCUMENT_ACCESS_GRANT_PERMISSION_RANK: Record<DocumentAccessGrantPermission, number> = {
  [DocumentAccessGrantPermission.VIEW]: 1,
  [DocumentAccessGrantPermission.COMMENT]: 1,
  [DocumentAccessGrantPermission.EDIT]: 2,
  [DocumentAccessGrantPermission.MANAGE]: 3,
};

@Injectable()
export class MikroOrmDocumentDetailQueryRepository extends DocumentDetailQueryRepository {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly documentAccessResolver: DocumentAccessResolver,
  ) {
    super();
  }

  async findDocumentDetail(input: {
    documentId: string;
    currentUser: AuthenticatedUser;
  }): Promise<DocumentSummary | null> {
    const entityManager = this.entityManager.fork();

    const document = await entityManager.findOne(DocumentEntity, {
      $or: [
        { id: input.documentId },
        { publicId: input.documentId },
      ],
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'createdBy', 'ownerUser', 'updatedBy'],
    });

    if (!document) {
      return null;
    }

    const ancestors = await this.findAncestorDocuments(document.id, entityManager);
    const documentAndAncestorIds = [document.id, ...ancestors.map((ancestor) => ancestor.id)];

    const workspaceMembership = await entityManager.findOne(
      WorkspaceMemberEntity,
      {
        workspace: document.workspace.id,
        user: input.currentUser.userId,
      },
      {
        populate: ['workspace', 'user'],
      },
    );

    const grants = await entityManager.find(
      DocumentAccessGrantEntity,
      {
        document: { $in: documentAndAncestorIds },
        user: input.currentUser.userId,
        revokedAt: null,
      },
      {
        populate: ['document', 'user', 'grantedBy'],
      },
    );

    const activeGrantCount = await entityManager.count(DocumentAccessGrantEntity, {
      document: { $in: documentAndAncestorIds },
      revokedAt: null,
    });

    const accessSetting = await entityManager.findOne(DocumentAccessSettingEntity, {
      document: document.id,
    });

    const favorite = await entityManager.findOne(DocumentFavoriteEntity, {
      workspace: document.workspace.id,
      user: input.currentUser.userId,
      document: document.id,
    });

    const publishedDocument = await entityManager.findOne(PublishedDocumentEntity, {
      document: document.id,
    });

    const directGrant = grants.find((grant) => grant.document.id === document.id);

    const strongestAncestorGrant = this.findStrongestGrant(
      grants.filter((grant) => grant.document.id !== document.id),
    );

    const capabilities = this.documentAccessResolver.resolve({
      actorUserId: input.currentUser.userId,
      documentOwnerUserId: document.ownerUser.id,
      documentTeamspaceId: document.teamspace?.id,
      documentHasActiveGrants: activeGrantCount > 0,
      directGrantPermission: directGrant?.permission,
      ancestorGrantPermission: strongestAncestorGrant?.permission,
      isWorkspaceMember: Boolean(workspaceMembership),
      workspaceMemberPermission: accessSetting?.workspaceMemberPermission,
      workspaceRole: workspaceMembership?.role,
    });

    if (!capabilities.canView) {
      return null;
    }

    return {
      ...toDocumentSummary(document),
      isFavorite: Boolean(favorite),
      publishedDocumentId: publishedDocument?.id,
      publicPath: publishedDocument ? `/share/${publishedDocument.id}` : undefined,
      breadcrumb: this.toBreadcrumb(ancestors),
      access: {
        scope: capabilities.accessScope,
        permission: capabilities.permission,
        canView: capabilities.canView,
        canEdit: capabilities.canEdit,
        canManage: capabilities.canManageAccess,
        workspaceMemberPermission: accessSetting?.workspaceMemberPermission,
      },
      collaboration: {
        enabled: capabilities.accessScope !== 'private',
        mode: capabilities.canEdit && !document.archivedAt ? 'edit' : 'view',
        showPresence: capabilities.accessScope !== 'private' && !document.archivedAt,
      },
    };
  }

  async findDocumentDetailsForAiSource(input: {
    documentIds: string[];
    currentUser: AuthenticatedUser;
  }): Promise<AiSourceDocument[]> {
    if (input.documentIds.length === 0) {
      return [];
    }

    const entityManager = this.entityManager.fork();
    const requestedDocumentIds = [...new Set(input.documentIds)];

    const documents = await entityManager.find(DocumentEntity, {
      $or: [
        { id: { $in: requestedDocumentIds } },
        { publicId: { $in: requestedDocumentIds } },
      ],
    }, {
      populate: ['workspace', 'teamspace', 'parentDocument', 'ownerUser'],
    });

    const documentByIdentifier = new Map<string, DocumentEntity>();

    for (const document of documents) {
      documentByIdentifier.set(document.id, document);
      documentByIdentifier.set(document.publicId, document);
    }

    const orderedDocuments = input.documentIds.flatMap((documentId) => {
      const document = documentByIdentifier.get(documentId);
      return document ? [document] : [];
    });
    const uniqueDocuments = [...new Map(
      orderedDocuments.map((document) => [document.id, document]),
    ).values()];

    if (uniqueDocuments.length === 0) {
      return [];
    }

    const documentIds = uniqueDocuments.map((document) => document.id);
    const ancestorsByDocumentId = await this.findAncestorDocumentsByDocumentIds(
      documentIds,
      entityManager,
    );
    const documentAndAncestorIds = [...new Set([
      ...documentIds,
      ...[...ancestorsByDocumentId.values()].flatMap((ancestors) =>
        ancestors.map((ancestor) => ancestor.id),
      ),
    ])];

    const workspaceIds = [...new Set(
      uniqueDocuments.map((document) => document.workspace.id),
    )];

    const workspaceMemberships = await entityManager.find(
      WorkspaceMemberEntity,
      {
        workspace: { $in: workspaceIds },
        user: input.currentUser.userId,
      },
      {
        populate: ['workspace', 'user'],
      },
    );
    const grants = await entityManager.find(
      DocumentAccessGrantEntity,
      {
        document: { $in: documentAndAncestorIds },
        user: input.currentUser.userId,
        revokedAt: null,
      },
      {
        populate: ['document', 'user', 'grantedBy'],
      },
    );
    const activeGrantCounts = await this.countActiveGrantsByDocumentId(
      documentAndAncestorIds,
      entityManager,
    );
    const accessSettings = await entityManager.find(
      DocumentAccessSettingEntity,
      {
        document: { $in: documentIds },
      },
      {
        populate: ['document'],
      },
    );

    const membershipByWorkspaceId = new Map(
      workspaceMemberships.map((membership) => [membership.workspace.id, membership]),
    );
    const accessSettingByDocumentId = new Map(
      accessSettings.map((setting) => [setting.document.id, setting]),
    );

    const viewableDocumentIds = new Set<string>();

    for (const document of uniqueDocuments) {
      const ancestors = ancestorsByDocumentId.get(document.id) ?? [];
      const accessDocumentIds = new Set([
        document.id,
        ...ancestors.map((ancestor) => ancestor.id),
      ]);
      const documentGrants = grants.filter((grant) => accessDocumentIds.has(grant.document.id));
      const directGrant = documentGrants.find((grant) => grant.document.id === document.id);
      const strongestAncestorGrant = this.findStrongestGrant(
        documentGrants.filter((grant) => grant.document.id !== document.id),
      );
      const hasActiveGrants = [...accessDocumentIds].some((documentId) =>
        (activeGrantCounts.get(documentId) ?? 0) > 0,
      );
      const workspaceMembership = membershipByWorkspaceId.get(document.workspace.id);
      const accessSetting = accessSettingByDocumentId.get(document.id);
      const capabilities = this.documentAccessResolver.resolve({
        actorUserId: input.currentUser.userId,
        documentOwnerUserId: document.ownerUser.id,
        documentTeamspaceId: document.teamspace?.id,
        documentHasActiveGrants: hasActiveGrants,
        directGrantPermission: directGrant?.permission,
        ancestorGrantPermission: strongestAncestorGrant?.permission,
        isWorkspaceMember: Boolean(workspaceMembership),
        workspaceMemberPermission: accessSetting?.workspaceMemberPermission,
        workspaceRole: workspaceMembership?.role,
      });

      if (capabilities.canView) {
        viewableDocumentIds.add(document.id);
      }
    }

    return orderedDocuments
      .filter((document) => viewableDocumentIds.has(document.id))
      .map((document) => ({
        id: document.id,
        workspaceId: document.workspace.id,
        title: document.title,
        content: document.contentJson,
      }));
  }

  private async findAncestorDocuments(
    documentId: string,
    entityManager: EntityManager,
  ): Promise<AncestorDocumentRow[]> {
    return entityManager.getConnection().execute<AncestorDocumentRow[]>(
      `
        with recursive ancestors as (
          select
            parent.id,
            parent.public_id as "publicId",
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
            parent.public_id as "publicId",
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
          "publicId",
          title,
          depth
        from ancestors
        order by depth asc
      `,
      [documentId, MAX_DOCUMENT_ANCESTOR_DEPTH],
    );
  }

  private async findAncestorDocumentsByDocumentIds(
    documentIds: string[],
    entityManager: EntityManager,
  ): Promise<Map<string, AncestorDocumentRow[]>> {
    const rows = await entityManager.getConnection().execute<BatchAncestorDocumentRow[]>(
      `
        with recursive ancestors as (
          select
            child.id as document_id,
            parent.id,
            parent.public_id as "publicId",
            parent.title,
            parent.parent_document_id,
            0 as depth,
            array[child.id, parent.id] as path
          from documents child
          join documents parent on parent.id = child.parent_document_id
          where child.id = any(?)

          union all

          select
            ancestors.document_id,
            parent.id,
            parent.public_id as "publicId",
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
          document_id as "documentId",
          id,
          "publicId",
          title,
          depth
        from ancestors
        order by document_id asc, depth asc
      `,
      [documentIds, MAX_DOCUMENT_ANCESTOR_DEPTH],
    );

    const ancestorsByDocumentId = new Map<string, AncestorDocumentRow[]>();

    for (const row of rows) {
      const ancestors = ancestorsByDocumentId.get(row.documentId) ?? [];
      ancestors.push({
        depth: row.depth,
        id: row.id,
        publicId: row.publicId,
        title: row.title,
      });
      ancestorsByDocumentId.set(row.documentId, ancestors);
    }

    return ancestorsByDocumentId;
  }

  private async countActiveGrantsByDocumentId(
    documentIds: string[],
    entityManager: EntityManager,
  ): Promise<Map<string, number>> {
    const rows = await entityManager.getConnection().execute<ActiveGrantCountRow[]>(
      `
        select
          document_id as "documentId",
          count(*)::int as "activeGrantCount"
        from document_access_grants
        where
          document_id = any(?)
          and revoked_at is null
        group by document_id
      `,
      [documentIds],
    );

    return new Map(
      rows.map((row) => [row.documentId, Number(row.activeGrantCount)]),
    );
  }

  private findStrongestGrant(
    grants: DocumentAccessGrantEntity[],
  ): DocumentAccessGrantEntity | undefined {
    return grants.reduce<DocumentAccessGrantEntity | undefined>((strongest, grant) => {
      if (
        !strongest
        || DOCUMENT_ACCESS_GRANT_PERMISSION_RANK[grant.permission] >
          DOCUMENT_ACCESS_GRANT_PERMISSION_RANK[strongest.permission]
      ) {
        return grant;
      }

      return strongest;
    }, undefined);
  }

  private toBreadcrumb(ancestors: AncestorDocumentRow[]): DocumentBreadcrumbItem[] {
    return ancestors
      .toReversed()
      .map((ancestor) => ({
        id: ancestor.id,
        publicId: ancestor.publicId,
        title: ancestor.title,
      }));
  }
}
