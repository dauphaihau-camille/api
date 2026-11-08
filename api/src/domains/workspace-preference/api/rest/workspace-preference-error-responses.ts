import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Workspace-preference-domain error payloads for the `@ApiErrorResponses`
 * decorator.
 *
 * The `code` and `message` mirror what the workspace preference HTTP error
 * mapper emits at runtime; the example is keyed by its `code` so
 * several failures of the same status can coexist on one operation.
 */
export const workspacePreferenceWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_PREFERENCE_WORKSPACE_NOT_FOUND',
  message: 'Workspace workspace_123 was not found.',
};
