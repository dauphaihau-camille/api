import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Workspace-preference-domain error payloads for the `@ApiErrorResponses`
 * decorator.
 *
 * The `code` and `message` mirror what the workspace preference HTTP error
 * mapper emits at runtime; the `error` label is only the example name so
 * several failures of the same status can coexist on one operation.
 */
export const workspacePreferenceWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_PREFERENCE_WORKSPACE_NOT_FOUND',
  error: 'Workspace Preference Workspace Not Found',
  message: 'Workspace workspace_123 was not found.',
};
