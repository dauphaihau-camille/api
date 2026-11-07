import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Reusable public error example payloads for the `@ApiErrorResponses`
 * decorator.
 *
 * Controllers keep the response statuses and select the examples that actually
 * apply; this module only owns the shared, exact payload shapes so the same
 * failure is documented identically everywhere. It never declares a status.
 */
export const validationErrorExample: ApiErrorExample = {
  error: 'Bad Request',
  message: ['email must be an email'],
};

export const unauthorizedErrorExample: ApiErrorExample = {
  error: 'Unauthorized',
  message: 'Unauthorized',
};

export const forbiddenErrorExample: ApiErrorExample = {
  error: 'Forbidden',
  message: 'Missing required permissions',
};

export const notFoundErrorExample: ApiErrorExample = {
  error: 'Not Found',
  message: 'Resource not found',
};

export const conflictErrorExample: ApiErrorExample = {
  error: 'Conflict',
  message: 'Resource already exists',
};

export const internalServerErrorExample: ApiErrorExample = {
  error: 'Internal Server Error',
  message: 'Internal server error',
};
