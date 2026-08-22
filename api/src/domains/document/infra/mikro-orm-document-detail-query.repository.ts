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
import { DocumentDetailQueryRepository } from '../app/ports/document-detail-query.repository';
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
