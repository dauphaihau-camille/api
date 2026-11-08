import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Search-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the search HTTP error mapper emits at
 * runtime; the `error` label is only the example name so several failures of
 * the same status can coexist on one operation.
 */
export const searchWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'SEARCH_WORKSPACE_NOT_FOUND',
  error: 'Search Workspace Not Found',
  message: 'Workspace workspace_123 was not found.',
};
