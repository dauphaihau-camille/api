import type { ApiErrorExample } from '~/platform/http/api-error-responses.decorator';

/**
 * Reusable public error example payloads for the `@ApiErrorResponses`
 * decorator.
 *
 * Controllers keep the response statuses and select the examples that actually
 * apply; this module only owns the cross-cutting, exact payload shapes so the
 * same failure is documented identically everywhere. It never declares a
 * status. Domain-specific examples live next to the controllers that use them,
 * in `src/domains/<domain>/api/rest/<domain>-error-responses.ts`; guard
 * failures (401 from `JwtAuthGuard`, 403 from `PermissionsGuard`) are owned by
 * the auth domain in `src/domains/auth/api/rest/auth-error-examples.ts`.
 *
 * Every example carries the stable `code` the envelope emits, so consumers can
 * key on it instead of the human-readable `message`.
 */
export const validationErrorExample: ApiErrorExample = {
  code: 'VALIDATION_FAILED',
  message: 'Validation failed',
  details: {
    fields: [
      { field: 'email', messages: ['email must be an email'] },
    ],
  },
};

export const internalServerErrorExample: ApiErrorExample = {
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Internal server error',
};

export const tooManyRequestsErrorExample: ApiErrorExample = {
  code: 'RATE_LIMIT_EXCEEDED',
  message: 'Too many requests.',
};
