import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Membership-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the membership HTTP error mapper emits
 * at runtime; the example is keyed by its `code` so several failures
 * of the same status can coexist on one operation.
 */
export const membershipNotFoundErrorExample: ApiErrorExample = {
  code: 'MEMBERSHIP_NOT_FOUND',
  message: 'Workspace member was not found.',
};

export const membershipWorkspaceNotFoundErrorExample: ApiErrorExample = {
  code: 'MEMBERSHIP_WORKSPACE_NOT_FOUND',
  message: 'Workspace workspace_123 was not found.',
};

export const membershipUserNotFoundErrorExample: ApiErrorExample = {
  code: 'MEMBERSHIP_USER_NOT_FOUND',
  message: 'User user@example.com was not found.',
};

export const membershipAlreadyExistsErrorExample: ApiErrorExample = {
  code: 'MEMBERSHIP_ALREADY_EXISTS',
  message: 'That user is already a workspace member.',
};

export const membershipVersionConflictErrorExample: ApiErrorExample = {
  code: 'MEMBERSHIP_VERSION_CONFLICT',
  message: 'Workspace member version conflict.',
};

export const membershipLastOwnerConflictErrorExample: ApiErrorExample = {
  code: 'MEMBERSHIP_LAST_OWNER_CONFLICT',
  message: 'Workspace must keep at least one owner.',
};
