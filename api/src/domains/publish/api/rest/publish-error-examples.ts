import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Publish-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the publish HTTP error mapper emits at
 * runtime; the example is keyed by its `code` so several failures of
 * the same status can coexist on one operation.
 */
export const publishedDocumentNotFoundErrorExample: ApiErrorExample = {
  code: 'PUBLISHED_DOCUMENT_NOT_FOUND',
  message: 'Published document published_document_123 was not found.',
};

export const publishDocumentNotFoundErrorExample: ApiErrorExample = {
  code: 'PUBLISH_DOCUMENT_NOT_FOUND',
  message: 'Document document_123 was not found.',
};

export const publishPermissionDeniedErrorExample: ApiErrorExample = {
  code: 'PUBLISH_PERMISSION_DENIED',
  message: 'You do not have permission to publish this document.',
};
