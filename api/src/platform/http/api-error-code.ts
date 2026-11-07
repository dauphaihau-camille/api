import { HttpStatus } from '@nestjs/common';

/**
 * Stable, machine-readable error codes for the public error envelope.
 *
 * The envelope always carries a `code` so clients can branch on failures
 * without parsing messages or reading internal class names. Codes are derived
 * in this order:
 *
 * 1. an explicit `code` already present on the HTTP exception payload, when it
 *    is already `UPPER_SNAKE_CASE`;
 * 2. a code preserved by the domain HTTP error mapper, derived from the
 *    domain error's `code` (which defaults to the error class name);
 * 3. a status-based fallback from `HTTP_ERROR_CODE_FALLBACKS`.
 */

/** Matches canonical `UPPER_SNAKE_CASE` codes only. */
const UPPER_SNAKE_CASE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

const ERROR_SUFFIX_PATTERN = /Error$/;

/**
 * Status-based fallback codes. These are the only codes the filter invents; a
 * status missing from the table falls back to `BAD_REQUEST` for 4xx and
 * `INTERNAL_SERVER_ERROR` otherwise.
 */
export const HTTP_ERROR_CODE_FALLBACKS: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.NOT_IMPLEMENTED]: 'NOT_IMPLEMENTED',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
  [HttpStatus.GATEWAY_TIMEOUT]: 'GATEWAY_TIMEOUT',
};

/** True when `value` is a canonical `UPPER_SNAKE_CASE` code. */
export function isUpperSnakeCase(value: string): boolean {
  return UPPER_SNAKE_CASE_PATTERN.test(value);
}

/**
 * Converts a domain error code or class name into `UPPER_SNAKE_CASE`.
 *
 * `DocumentNotFoundError` -> `DOCUMENT_NOT_FOUND`,
 * `workspace_block_limit_reached` -> `WORKSPACE_BLOCK_LIMIT_REACHED`.
 */
export function toUpperSnakeCase(value: string): string {
  return value
    .replace(ERROR_SUFFIX_PATTERN, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

/**
 * Derives a code from a thrown domain or application error.
 *
 * An explicit string `code` wins; otherwise the error class name is used, the
 * same default `DomainError` applies. Returns `undefined` when the derived
 * value is not a usable code, so callers can fall back to the status.
 */
export function deriveErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { code?: unknown };
  const source = typeof candidate.code === 'string' && candidate.code !== ''
    ? candidate.code
    : error instanceof Error
      ? error.constructor.name
      : undefined;

  if (source === undefined) {
    return undefined;
  }

  const derived = toUpperSnakeCase(source);

  return isUpperSnakeCase(derived) ? derived : undefined;
}

/**
 * Builds an HTTP exception payload that preserves the domain error's code.
 *
 * Used by every `*-http-error-mapper.ts` so that mapping a domain error keeps
 * its stable code instead of degrading to the status fallback.
 */
export function toHttpErrorPayload(
  error: { message: string },
): { message: string; code?: string } {
  const code = deriveErrorCode(error);

  return code === undefined
    ? { message: error.message }
    : { code, message: error.message };
}

/**
 * Resolves the envelope `code` for a failed request.
 *
 * `payloadCode` is whatever the HTTP exception response carried; a canonical
 * `UPPER_SNAKE_CASE` value is used verbatim, anything else is ignored so an
 * internal class name can never leak as a code.
 */
export function resolveErrorCode(statusCode: number, payloadCode?: unknown): string {
  if (typeof payloadCode === 'string' && isUpperSnakeCase(payloadCode)) {
    return payloadCode;
  }

  const fallback = HTTP_ERROR_CODE_FALLBACKS[statusCode];

  if (fallback !== undefined) {
    return fallback;
  }

  return statusCode >= 400 && statusCode < 500
    ? HTTP_ERROR_CODE_FALLBACKS[HttpStatus.BAD_REQUEST]
    : HTTP_ERROR_CODE_FALLBACKS[HttpStatus.INTERNAL_SERVER_ERROR];
}
