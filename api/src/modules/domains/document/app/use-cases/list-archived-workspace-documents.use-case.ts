import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '~/modules/domains/auth/app/auth.types';
import type { ArchivedDocumentListItem, ArchivedDocumentListPage } from '../contracts/document.contract';
import type { ListArchivedWorkspaceDocumentsInput } from '../contracts/document.input';
import { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import {
  DocumentNotFoundError,
  InvalidDocumentCursorError,
} from '../errors/document-app.error';
import { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { resolveWorkspaceForUser } from '../policies/resolve-workspace-for-user';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { hasMeaningfulContent } from '../utils/document-content.util';

@Injectable()
export class ListArchivedWorkspaceDocumentsUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly documentNavigationQueryRepository: DocumentNavigationQueryRepository,
  ) {}

  async execute(
    workspaceIdentifier: string,
    currentUser: AuthenticatedUser,
    input: ListArchivedWorkspaceDocumentsInput,
  ): Promise<ArchivedDocumentListPage> {
    const workspace = await resolveWorkspaceForUser(
      this.workspaceRepository,
      workspaceIdentifier,
      currentUser,
    );
    const documents = await this.documentNavigationQueryRepository.findArchivedDocuments({
      workspaceId: workspace.id,
      query: input.query,
    });
    const topLevelArchivedDocuments = documents.filter((document) =>
      !document.parentDocument || !document.parentDocument.archivedAt);
    const cursor = input.cursor
      ? this.decodeCursor(input.cursor)
      : undefined;
    const visibleDocuments = cursor
      ? topLevelArchivedDocuments.filter((document) =>
        (document.archivedAt?.getTime() ?? 0) < cursor.archivedAt
          || (
            (document.archivedAt?.getTime() ?? 0) === cursor.archivedAt
            && document.id < cursor.id
          ))
      : topLevelArchivedDocuments;
    const pagedDocuments = visibleDocuments.slice(0, input.limit + 1);
    const hasMore = pagedDocuments.length > input.limit;
    const items = pagedDocuments.slice(0, input.limit);

    return {
      items: await Promise.all(items.map((document) => this.toListItem(document))),
      nextCursor: hasMore ? this.encodeCursor(items[items.length - 1]!) : undefined,
    };
  }

  private async toListItem(document: DocumentEntity): Promise<ArchivedDocumentListItem> {
    if (!document.archivedAt) {
      throw new DocumentNotFoundError(document.id);
    }

    return {
      id: document.id,
      publicId: document.publicId,
      version: document.version,
      title: document.title,
      hasContent: hasMeaningfulContent(document.contentJson),
      breadcrumbPath: await this.buildBreadcrumbPath(document),
      archivedAt: document.archivedAt,
    };
  }

  private async buildBreadcrumbPath(document: DocumentEntity): Promise<string[]> {
    const breadcrumbPath: string[] = [];

    if (document.teamspace?.name) {
      breadcrumbPath.push(document.teamspace.name);
    }

    return [
      ...breadcrumbPath,
      ...(await this.documentNavigationQueryRepository.findAncestors(
        document.parentDocument?.id,
      )).map((ancestor) => ancestor.title),
    ];
  }

  private encodeCursor(document: DocumentEntity): string {
    return Buffer.from(JSON.stringify({
      id: document.id,
      archivedAt: document.archivedAt?.getTime(),
    })).toString('base64url');
  }

  private decodeCursor(cursor: string): { id: string; archivedAt: number } {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
        id?: unknown;
        archivedAt?: unknown;
      };

      if (typeof parsed.id !== 'string' || typeof parsed.archivedAt !== 'number') {
        throw new Error('Invalid cursor');
      }

      return {
        id: parsed.id,
        archivedAt: parsed.archivedAt,
      };
    }
    catch {
      throw new InvalidDocumentCursorError();
    }
  }
}
