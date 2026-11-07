import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Reusable public error example payloads for the `@ApiErrorResponses`
 * decorator.
 *
 * Controllers keep the response statuses and select the examples that actually
 * apply; this module only owns the shared, exact payload shapes so the same
 * failure is documented identically everywhere. It never declares a status.
 *
 * Every example carries the stable `code` the envelope emits, so consumers can
 * key on it instead of the human-readable `message`.
 */
export const validationErrorExample: ApiErrorExample = {
  code: 'BAD_REQUEST',
  error: 'Bad Request',
  message: ['email must be an email'],
};

export const unauthorizedErrorExample: ApiErrorExample = {
  code: 'UNAUTHORIZED',
  error: 'Unauthorized',
  message: 'Unauthorized',
};

export const forbiddenErrorExample: ApiErrorExample = {
  code: 'FORBIDDEN',
  error: 'Forbidden',
  message: 'Missing required permissions',
};

export const notFoundErrorExample: ApiErrorExample = {
  code: 'NOT_FOUND',
  error: 'Not Found',
  message: 'Resource not found',
};

export const conflictErrorExample: ApiErrorExample = {
  code: 'CONFLICT',
  error: 'Conflict',
  message: 'Resource already exists',
};

export const internalServerErrorExample: ApiErrorExample = {
  code: 'INTERNAL_SERVER_ERROR',
  error: 'Internal Server Error',
  message: 'Internal server error',
};
