import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Teamspace-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the teamspace HTTP error mapper emits at
 * runtime; the example is keyed by its `code` so several failures of
 * the same status can coexist on one operation.
 */
export const teamspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_NOT_FOUND',
  message: 'Teamspace teamspace_123 was not found.',
};

export const teamspaceWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_WORKSPACE_NOT_FOUND',
  message: 'Workspace workspace_123 was not found.',
};

export const teamspaceNameTooShortErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_NAME_TOO_SHORT',
  message: 'Teamspace name must be at least 2 characters.',
};

export const teamspacePermissionDeniedErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_PERMISSION_DENIED',
  message: 'You do not have permission to update this workspace.',
};

export const teamspaceVersionConflictErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_VERSION_CONFLICT',
  message: 'Teamspace version conflict.',
};
