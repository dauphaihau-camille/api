import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { DocumentAccessResolver } from '~/domains/document/app/policies/document-access.resolver';
import { hasMeaningfulContent } from '~/domains/document/app/utils/document-content.util';
import { DocumentEntity } from '~/domains/document/infra/persistence/entities/document.entity';
import type { TeamspaceMemberRole } from '~/domains/teamspace/domain/enums/teamspace-member-role.enum';
import { WorkspaceRepository } from '~/domains/workspace/app/ports/workspace.repository';
import type { WorkspaceRole } from '~/domains/workspace/domain/enums/workspace-role.enum';
import type { SearchDocumentSummary } from '../contracts/search.contract';
import { resolveSearchWorkspaceForUser } from '../policies/resolve-search-workspace-for-user';
import { SearchRepository } from '../ports/search.repository';

@Injectable()
export class SearchWorkspaceDocumentsUseCase {
  constructor(
    private readonly searchRepository: SearchRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentAccessResolver: DocumentAccessResolver,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    query?: string,
    limit = 20,
  ): Promise<SearchDocumentSummary[]> {
    const workspace = await resolveSearchWorkspaceForUser(
      this.workspaceRepository,
      workspaceIdentifier,
      currentUser,
    );

    const normalizedQuery = query?.trim();

    if (!normalizedQuery) {
      return this.mapDocumentsToSummaries(
        this.filterViewableDocuments(await this.searchRepository.findRecentVisitedDocuments({
          workspaceId: workspace.id,
          userId: currentUser.userId,
          limit,
        }), currentUser.userId, workspace.currentUserRole),
      );
    }

    return this.mapDocumentsToSummaries(
      this.filterViewableDocuments(await this.searchRepository.findMatchedDocuments({
        workspaceId: workspace.id,
        userId: currentUser.userId,
        query: normalizedQuery,
        limit,
      }), currentUser.userId, workspace.currentUserRole),
    );
  }

  private filterViewableDocuments<T extends {
    document: DocumentEntity;
    teamspaceMemberRole?: TeamspaceMemberRole;
  }>(
    items: T[],
    userId: string,
    workspaceRole: WorkspaceRole,
  ): T[] {
    return items.filter((item) => this.documentAccessResolver.resolve({
      actorUserId: userId,
      documentOwnerUserId: item.document.ownerUser.id,
      documentTeamspaceId: item.document.teamspace?.id,
      teamspaceAccessMode: item.document.teamspace?.accessMode,
      teamspaceMemberRole: item.teamspaceMemberRole,
      workspaceRole,
    }).canView);
  }

  private async mapDocumentsToSummaries(
    items: Array<{
      document: DocumentEntity;
      matchedText?: string;
      visitedAt?: Date;
    }>,
  ): Promise<SearchDocumentSummary[]> {
    return Promise.all(items.map(async (item) => ({
      documentId: item.document.id,
      publicId: item.document.publicId,
      workspaceId: item.document.workspace.id,
      teamspaceId: item.document.teamspace?.id,
      parentDocumentId: item.document.parentDocument?.id,
      title: item.document.title,
      hasContent: hasMeaningfulContent(item.document.contentJson),
      breadcrumbPath: await this.buildBreadcrumbPath(item.document),
      updatedByName: item.document.updatedBy.displayName ?? item.document.updatedBy.email,
      matchedText: item.matchedText,
      updatedAt: item.document.updatedAt,
      visitedAt: item.visitedAt,
    })));
  }

  private async buildBreadcrumbPath(document: DocumentEntity): Promise<string[]> {
    const breadcrumbPath: string[] = [];

    if (document.teamspace?.name) {
      breadcrumbPath.push(document.teamspace.name);
    }

    return [
      ...breadcrumbPath,
      ...await this.searchRepository.findAncestorTitles(document.parentDocument?.id),
    ];
  }
}
