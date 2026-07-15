import type { DocumentEntity } from '../../../document/infra/persistence/entities/document.entity';

export function filterCascadePublishedDocuments(
  subtree: DocumentEntity[],
): DocumentEntity[] {
  const excludedDocumentIds = new Set<string>();
  const includedDocuments: DocumentEntity[] = [];

  for (const document of subtree) {
    const parentDocumentId = document.parentDocument?.id;

    if (parentDocumentId && excludedDocumentIds.has(parentDocumentId)) {
      excludedDocumentIds.add(document.id);
      continue;
    }

    if (document.publicAccessOverride === 'unpublished') {
      excludedDocumentIds.add(document.id);
      continue;
    }

    includedDocuments.push(document);
  }

  return includedDocuments;
}
