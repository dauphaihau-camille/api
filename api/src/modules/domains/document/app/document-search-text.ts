export function extractDocumentSearchText(content: unknown[]): string {
  return normalizeWhitespace(collectTextNodes(content).join(' '));
}

function collectTextNodes(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextNodes(item));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, itemValue]) => {
      if (key === 'text' && typeof itemValue === 'string') {
        return [itemValue];
      }

      if (key === 'content' || key === 'children') {
        return collectTextNodes(itemValue);
      }

      return [];
    });
  }

  return [];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
