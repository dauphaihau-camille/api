import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Auth-domain error payloads for the `@ApiErrorResponses` decorator.
 *
 * The `code` and `message` mirror what the auth HTTP exception filter emits at
 * runtime; the example is keyed by its `code` so several failures of
 * the same status can coexist on one operation.
 */
export const invalidCredentialsErrorExample: ApiErrorExample = {
  code: 'INVALID_CREDENTIALS',
  message: 'Invalid email or password',
};

export const invalidRefreshTokenErrorExample: ApiErrorExample = {
  code: 'INVALID_REFRESH_TOKEN',
  message: 'Invalid refresh token',
};

export const refreshSessionNotFoundErrorExample: ApiErrorExample = {
  code: 'REFRESH_SESSION_NOT_FOUND',
  message: 'Refresh session was not found',
};

export const emailAlreadyRegisteredErrorExample: ApiErrorExample = {
  code: 'EMAIL_ALREADY_REGISTERED',
  message: 'Email is already registered',
};

export const emailAuthAccountNotFoundErrorExample: ApiErrorExample = {
  code: 'EMAIL_AUTH_ACCOUNT_NOT_FOUND',
  message: 'No account found for this email',
};

export const sessionNotActiveErrorExample: ApiErrorExample = {
  code: 'SESSION_NOT_ACTIVE',
  message: 'Session is not active',
};

export const inactiveUserErrorExample: ApiErrorExample = {
  code: 'INACTIVE_USER',
  message: 'User account is not active',
};

export const invalidEmailLoginCodeErrorExample: ApiErrorExample = {
  code: 'INVALID_EMAIL_LOGIN_CODE',
  message: 'Invalid login code',
};

export const googleOAuthProviderDisabledErrorExample: ApiErrorExample = {
  code: 'OAUTH_PROVIDER_DISABLED',
  message: 'Google OAuth is not enabled.',
};

export const githubOAuthProviderDisabledErrorExample: ApiErrorExample = {
  code: 'OAUTH_PROVIDER_DISABLED',
  message: 'GitHub OAuth is not enabled.',
};
