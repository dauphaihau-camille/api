import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Search-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the search HTTP error mapper emits at
 * runtime; the example is keyed by its `code` so several failures of
 * the same status can coexist on one operation.
 */
export const searchWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'SEARCH_WORKSPACE_NOT_FOUND',
  message: 'Workspace workspace_123 was not found.',
};
