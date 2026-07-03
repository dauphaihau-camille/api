import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import { hasMeaningfulContent } from '~/modules/domains/document/app/utils/document-content.util';
import { DocumentEntity } from '~/modules/domains/document/infra/persistence/entities/document.entity';
import { WorkspaceRepository } from '~/modules/domains/workspace/app/ports/workspace.repository';
import type { SearchDocumentSummary } from '../contracts/search.contract';
import { resolveSearchWorkspaceForUser } from '../policies/resolve-search-workspace-for-user';
import { SearchRepository } from '../ports/search.repository';

@Injectable()
export class SearchWorkspaceDocumentsUseCase {
  constructor(
    private readonly searchRepository: SearchRepository,
    private readonly workspaceRepository: WorkspaceRepository,
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
        await this.searchRepository.findRecentVisitedDocuments({
          workspaceId: workspace.id,
          userId: currentUser.userId,
          limit,
        }),
      );
    }

    return this.mapDocumentsToSummaries(
      await this.searchRepository.findMatchedDocuments({
        workspaceId: workspace.id,
        query: normalizedQuery,
        limit,
      }),
    );
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
