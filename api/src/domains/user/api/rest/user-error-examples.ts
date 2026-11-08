import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * User-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the user HTTP error mapper emits at
 * runtime; the `error` label is only the example name so several failures of
 * the same status can coexist on one operation.
 */
export const userNotFoundErrorExample: ApiErrorExample = {
  code: 'USER_NOT_FOUND',
  error: 'User Not Found',
  message: 'User was not found',
};

export const userEmailAlreadyRegisteredErrorExample: ApiErrorExample = {
  code: 'USER_EMAIL_ALREADY_REGISTERED',
  error: 'User Email Already Registered',
  message: 'Email is already registered',
};

export const userVersionConflictErrorExample: ApiErrorExample = {
  code: 'USER_VERSION_CONFLICT',
  error: 'User Version Conflict',
  message: 'User was updated by another request. Refresh and retry with the latest version.',
};

export const actorNotAllowedToCreateUsersErrorExample: ApiErrorExample = {
  code: 'ACTOR_NOT_ALLOWED_TO_CREATE_USERS',
  error: 'Actor Not Allowed To Create Users',
  message: 'Only admins can create users',
};

export const actorNotAllowedToUpdateUsersErrorExample: ApiErrorExample = {
  code: 'ACTOR_NOT_ALLOWED_TO_UPDATE_USERS',
  error: 'Actor Not Allowed To Update Users',
  message: 'Only admins can update users',
};
