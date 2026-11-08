import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Auth-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the auth HTTP exception filter emits at
 * runtime; the `error` label is only the example name so several failures of
 * the same status can coexist on one operation.
 */
export const invalidCredentialsErrorExample: ApiErrorExample = {
  code: 'INVALID_CREDENTIALS',
  error: 'Invalid Credentials',
  message: 'Invalid email or password',
};

export const invalidRefreshTokenErrorExample: ApiErrorExample = {
  code: 'INVALID_REFRESH_TOKEN',
  error: 'Invalid Refresh Token',
  message: 'Invalid refresh token',
};

export const refreshSessionNotFoundErrorExample: ApiErrorExample = {
  code: 'REFRESH_SESSION_NOT_FOUND',
  error: 'Refresh Session Not Found',
  message: 'Refresh session was not found',
};

export const emailAlreadyRegisteredErrorExample: ApiErrorExample = {
  code: 'EMAIL_ALREADY_REGISTERED',
  error: 'Email Already Registered',
  message: 'Email is already registered',
};

export const emailAuthAccountNotFoundErrorExample: ApiErrorExample = {
  code: 'EMAIL_AUTH_ACCOUNT_NOT_FOUND',
  error: 'Email Auth Account Not Found',
  message: 'No account found for this email',
};

export const sessionNotActiveErrorExample: ApiErrorExample = {
  code: 'SESSION_NOT_ACTIVE',
  error: 'Session Not Active',
  message: 'Session is not active',
};

export const inactiveUserErrorExample: ApiErrorExample = {
  code: 'INACTIVE_USER',
  error: 'Inactive User',
  message: 'User account is not active',
};

export const invalidEmailLoginCodeErrorExample: ApiErrorExample = {
  code: 'INVALID_EMAIL_LOGIN_CODE',
  error: 'Invalid Email Login Code',
  message: 'Invalid login code',
};
