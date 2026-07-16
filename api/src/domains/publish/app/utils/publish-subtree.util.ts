type PublishSubtreeDocument = {
  id: string;
  publicAccessOverride?: 'unpublished' | null;
  parentDocument?: { id: string } | null;
};

export function filterCascadePublishedDocuments<T extends PublishSubtreeDocument>(
  subtree: T[],
): T[] {
  const excludedDocumentIds = new Set<string>();
  const includedDocuments: T[] = [];

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
