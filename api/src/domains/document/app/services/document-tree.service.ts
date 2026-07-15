import { Injectable } from '@nestjs/common';
import { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentTreeQueryRepository } from '../ports/document-tree-query.repository';
import { DocumentEntity } from '../../infra/persistence/entities/document.entity';
import { SORT_STEP } from '../constants/document.constants';

@Injectable()
export class DocumentTreeService {
  constructor(
    private readonly documentTreeQueryRepository: DocumentTreeQueryRepository,
    private readonly documentCommandRepository: DocumentCommandRepository,
  ) {}

  async resolveSortKeyForCreate(
    workspaceId: string,
    parentDocumentId: string | undefined,
    teamspaceId: string | undefined,
  ): Promise<number> {
    const firstSibling = await this.documentTreeQueryRepository.findFirstSibling({
      workspaceId,
      parentDocumentId,
      teamspaceId,
    });

    return (firstSibling?.sortKey ?? SORT_STEP) - SORT_STEP;
  }

  async resolveSortKeyForMove(
    documentId: string,
    workspaceId: string,
    parentDocumentId: string | undefined,
    teamspaceId: string | undefined,
    index: number | undefined,
  ): Promise<number> {
    const siblings = await this.documentTreeQueryRepository.findSiblingDocumentsForMove({
      workspaceId,
      parentDocumentId,
      teamspaceId,
      excludeDocumentId: documentId,
    });

    if (index === undefined || index >= siblings.length) {
      const lastSortKey = siblings[siblings.length - 1]?.sortKey ?? -SORT_STEP;
      return lastSortKey + SORT_STEP;
    }

    if (index <= 0) {
      return (siblings[0]?.sortKey ?? SORT_STEP) - SORT_STEP;
    }

    const previous = siblings[index - 1];
    const next = siblings[index];

    if (next.sortKey - previous.sortKey > 1) {
      return previous.sortKey + Math.floor((next.sortKey - previous.sortKey) / 2);
    }

    siblings.splice(index, 0, { ...next, sortKey: next.sortKey } as DocumentEntity);
    siblings.forEach((sibling, siblingIndex) => {
      sibling.sortKey = siblingIndex * SORT_STEP;
    });
    await this.documentCommandRepository.saveDocuments(siblings);

    return siblings[index].sortKey;
  }

  async findDescendants(
    documentId: string,
    workspaceId: string,
  ): Promise<DocumentEntity[]> {
    return this.documentTreeQueryRepository.findDescendants(workspaceId, documentId);
  }

  async findActiveSubtreeDocuments(
    documentId: string,
    workspaceId: string,
  ): Promise<DocumentEntity[] | null> {
    return this.documentTreeQueryRepository.findActiveSubtreeDocuments(workspaceId, documentId);
  }

  async isDescendantOf(
    candidateDocumentId: string,
    ancestorDocumentId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const descendants = await this.findDescendants(ancestorDocumentId, workspaceId);

    return descendants.some((document) => document.id === candidateDocumentId);
  }

  buildDuplicateTitle(title: string): string {
    const match = title.match(/^(.*) \((\d+)\)$/);

    if (!match) {
      return `${title} (1)`;
    }

    return `${match[1]} (${Number(match[2]) + 1})`;
  }
}
