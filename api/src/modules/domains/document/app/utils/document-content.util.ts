import { DEFAULT_DOCUMENT_CONTENT } from '../constants/document.constants';

export function normalizeContent(value?: unknown[]): unknown[] {
  if (!value || value.length === 0) {
    return DEFAULT_DOCUMENT_CONTENT;
  }

  return value;
}

export function hasMeaningfulContent(content: unknown[]): boolean {
  if (!Array.isArray(content) || content.length === 0) {
    return false;
  }

  if (content.length > 1) {
    return true;
  }

  const [firstBlock] = content;

  if (!firstBlock || typeof firstBlock !== 'object' || Array.isArray(firstBlock)) {
    return true;
  }

  const block = firstBlock as {
    type?: unknown;
    content?: unknown;
    children?: unknown;
    props?: unknown;
  };

  if (block.type !== 'paragraph') {
    return true;
  }

  if (Array.isArray(block.content) && block.content.length > 0) {
    return true;
  }

  if (Array.isArray(block.children) && block.children.length > 0) {
    return true;
  }

  if (
    block.props
    && typeof block.props === 'object'
    && !Array.isArray(block.props)
    && Object.values(block.props).some((value) => value !== undefined && value !== null && value !== '')
  ) {
    return true;
  }

  return false;
}
