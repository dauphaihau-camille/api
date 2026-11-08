import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * User-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the user domain emits at runtime; the
 * example is keyed by its `code` so several failures of
 * the same status can coexist on one operation.
 */
export const userNotFoundErrorExample: ApiErrorExample = {
  code: 'USER_NOT_FOUND',
  message: 'User was not found',
};

export const userEmailAlreadyRegisteredErrorExample: ApiErrorExample = {
  code: 'USER_EMAIL_ALREADY_REGISTERED',
  message: 'Email is already registered',
};

export const userVersionConflictErrorExample: ApiErrorExample = {
  code: 'USER_VERSION_CONFLICT',
  message: 'User was updated by another request. Refresh and retry with the latest version.',
};

export const actorNotAllowedToCreateUsersErrorExample: ApiErrorExample = {
  code: 'ACTOR_NOT_ALLOWED_TO_CREATE_USERS',
  message: 'Only admins can create users',
};

export const actorNotAllowedToUpdateUsersErrorExample: ApiErrorExample = {
  code: 'ACTOR_NOT_ALLOWED_TO_UPDATE_USERS',
  message: 'Only admins can update users',
};

export const avatarFileInvalidTypeErrorExample: ApiErrorExample = {
  code: 'AVATAR_FILE_INVALID_TYPE',
  message: 'Avatar file must be an image',
};

export const avatarFileEmptyErrorExample: ApiErrorExample = {
  code: 'AVATAR_FILE_EMPTY',
  message: 'Avatar file is empty',
};
