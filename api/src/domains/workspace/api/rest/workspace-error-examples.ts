import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Workspace-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the workspace HTTP error mapper emits at
 * runtime; the `error` label is only the example name so several failures of
 * the same status can coexist on one operation.
 */
export const workspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_NOT_FOUND',
  error: 'Workspace Not Found',
  message: 'Workspace workspace_123 was not found.',
};

export const workspacePermissionDeniedErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_PERMISSION_DENIED',
  error: 'Workspace Permission Denied',
  message: 'You do not have permission to update this workspace.',
};

export const workspaceVersionConflictErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_VERSION_CONFLICT_APP',
  error: 'Workspace Version Conflict',
  message: 'Workspace version conflict.',
};

export const workspaceSlugInUseErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_SLUG_IN_USE',
  error: 'Workspace Slug In Use',
  message: 'Workspace domain is already in use.',
};

export const workspaceSlugReservedErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_SLUG_RESERVED',
  error: 'Workspace Slug Reserved',
  message: 'Workspace domain is reserved.',
};

export const workspaceSlugLengthErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_SLUG_LENGTH',
  error: 'Workspace Slug Length',
  message: 'Workspace domain must be 3 to 32 characters.',
};

export const workspaceSlugInvalidErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_SLUG_INVALID',
  error: 'Workspace Slug Invalid',
  message: 'Workspace domain is invalid.',
};

export const workspaceDeletePermissionDeniedErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_DELETE_PERMISSION_DENIED',
  error: 'Workspace Delete Permission Denied',
  message: 'Only workspace owners can delete this workspace.',
};
