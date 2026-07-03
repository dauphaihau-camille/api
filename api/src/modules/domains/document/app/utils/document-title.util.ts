import { DEFAULT_DOCUMENT_TITLE } from '../constants/document.constants';

export function normalizeTitle(value?: string): string {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : DEFAULT_DOCUMENT_TITLE;
}
