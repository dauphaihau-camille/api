export function normalizeExpandedDocumentIds(documentIds: string[] | undefined): string[] {
  if (!documentIds) {
    return [];
  }

  return [...new Set(
    documentIds
      .map((documentId) => documentId.trim())
      .filter((documentId) => documentId.length > 0),
  )];
}

export function normalizeExpandedDocumentIdsByScope(
  expandedDocumentIdsByScope: Record<string, string[]> | undefined,
): Record<string, string[]> {
  if (!expandedDocumentIdsByScope) {
    return {};
  }

  const normalizedEntries: Array<[string, string[]]> = [];

  for (const [scope, documentIds] of Object.entries(expandedDocumentIdsByScope)) {
    const normalizedScope = scope.trim();

    if (normalizedScope.length === 0) {
      continue;
    }

    normalizedEntries.push([
      normalizedScope,
      normalizeExpandedDocumentIds(documentIds),
    ]);
  }

  return Object.fromEntries(normalizedEntries);
}
