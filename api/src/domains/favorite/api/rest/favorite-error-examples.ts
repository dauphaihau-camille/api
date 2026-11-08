import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Favorite-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the favorite HTTP error mapper emits at
 * runtime; the `error` label is only the example name so several failures of
 * the same status can coexist on one operation.
 */
export const favoriteDocumentNotFoundErrorExample: ApiErrorExample = {
  code: 'FAVORITE_DOCUMENT_NOT_FOUND',
  error: 'Favorite Document Not Found',
  message: 'Document document_123 was not found.',
};

export const favoriteWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'FAVORITE_WORKSPACE_NOT_FOUND',
  error: 'Favorite Workspace Not Found',
  message: 'Workspace workspace_123 was not found.',
};
