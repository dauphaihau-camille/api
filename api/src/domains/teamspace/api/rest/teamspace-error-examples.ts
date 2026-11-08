import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Teamspace-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the teamspace HTTP error mapper emits at
 * runtime; the `error` label is only the example name so several failures of
 * the same status can coexist on one operation.
 */
export const teamspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_NOT_FOUND',
  error: 'Teamspace Not Found',
  message: 'Teamspace teamspace_123 was not found.',
};

export const teamspaceWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_WORKSPACE_NOT_FOUND',
  error: 'Teamspace Workspace Not Found',
  message: 'Workspace workspace_123 was not found.',
};

export const teamspaceNameTooShortErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_NAME_TOO_SHORT',
  error: 'Teamspace Name Too Short',
  message: 'Teamspace name must be at least 2 characters.',
};

export const teamspacePermissionDeniedErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_PERMISSION_DENIED',
  error: 'Teamspace Permission Denied',
  message: 'You do not have permission to update this workspace.',
};

export const teamspaceVersionConflictErrorExample: ApiErrorExample = {
  code: 'TEAMSPACE_VERSION_CONFLICT',
  error: 'Teamspace Version Conflict',
  message: 'Teamspace version conflict.',
};
