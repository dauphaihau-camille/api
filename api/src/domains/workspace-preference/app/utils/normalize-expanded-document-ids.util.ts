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
