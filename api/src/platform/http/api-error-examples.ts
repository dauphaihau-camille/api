import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Reusable public error example payloads for the `@ApiErrorResponses`
 * decorator.
 *
 * Controllers keep the response statuses and select the examples that actually
 * apply; this module only owns the cross-cutting, exact payload shapes so the
 * same failure is documented identically everywhere. It never declares a
 * status. Domain-specific examples live next to the controllers that use them,
 * in `src/domains/<domain>/api/rest/<domain>-error-examples.ts`.
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

export const internalServerErrorExample: ApiErrorExample = {
  code: 'INTERNAL_SERVER_ERROR',
  error: 'Internal Server Error',
  message: 'Internal server error',
};

export const tooManyRequestsErrorExample: ApiErrorExample = {
  code: 'TOO_MANY_REQUESTS',
  error: 'Too Many Requests',
  message: 'Too many requests.',
};
