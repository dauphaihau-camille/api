import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Publish-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the publish HTTP error mapper emits at
 * runtime; the `error` label is only the example name so several failures of
 * the same status can coexist on one operation.
 */
export const publishedDocumentNotFoundErrorExample: ApiErrorExample = {
  code: 'PUBLISHED_DOCUMENT_NOT_FOUND',
  error: 'Published Document Not Found',
  message: 'Published document published_document_123 was not found.',
};

export const publishDocumentNotFoundErrorExample: ApiErrorExample = {
  code: 'PUBLISH_DOCUMENT_NOT_FOUND',
  error: 'Publish Document Not Found',
  message: 'Document document_123 was not found.',
};

export const publishPermissionDeniedErrorExample: ApiErrorExample = {
  code: 'PUBLISH_PERMISSION_DENIED',
  error: 'Publish Permission Denied',
  message: 'You do not have permission to publish this document.',
};
