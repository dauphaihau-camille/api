import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Workspace-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the workspace HTTP error mapper emits at
 * runtime; the example is keyed by its `code` so several failures of
 * the same status can coexist on one operation.
 */
export const workspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_NOT_FOUND',
  message: 'Workspace workspace_123 was not found.',
};

export const workspacePermissionDeniedErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_PERMISSION_DENIED',
  message: 'You do not have permission to update this workspace.',
};

export const workspaceVersionConflictErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_VERSION_CONFLICT_APP',
  message: 'Workspace version conflict.',
};

export const workspaceSlugInUseErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_SLUG_IN_USE',
  message: 'Workspace domain is already in use.',
};

export const workspaceSlugReservedErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_SLUG_RESERVED',
  message: 'Workspace domain is reserved.',
};

export const workspaceSlugLengthErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_SLUG_LENGTH',
  message: 'Workspace domain must be 3 to 32 characters.',
};

export const workspaceSlugInvalidErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_SLUG_INVALID',
  message: 'Workspace domain is invalid.',
};

export const workspaceDeletePermissionDeniedErrorExample: ApiErrorExample = {
  code: 'WORKSPACE_DELETE_PERMISSION_DENIED',
  message: 'Only workspace owners can delete this workspace.',
};
