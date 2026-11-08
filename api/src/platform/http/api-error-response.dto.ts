import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Public error envelope emitted by `GlobalExceptionFilter` for every failed
 * request.
 *
 * Mirrors the payload built by `buildErrorResponse`; keep both in sync. The
 * wire format is snake_case, matching every other external JSON payload.
 */
export class ApiErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code. Always matches the response status line.',
    example: 400,
  })
  status_code!: number;

  @ApiProperty({
    description:
      'Stable machine-readable error code in `UPPER_SNAKE_CASE`. ' +
      'Derived from the domain error code, the exception payload, or the ' +
      'HTTP status fallback; internal class names are never exposed. ' +
      'Also used as the stable key of the documented example.',
    example: 'DOCUMENT_NOT_FOUND',
  })
  code!: string;

  @ApiProperty({
    description:
      'Human-readable error summary. Validation failures always return ' +
      '`Validation failed` and expose the per-field reasons in ' +
      '`details.fields`.',
    example: 'Document document_123 was not found.',
  })
  message!: string;

  @ApiPropertyOptional({
    description:
      'Request correlation id. Also returned in the X-Request-Id response ' +
      'header and logged.',
    example: '3f6c1b1e-2b0f-4d5a-9d0e-7a1f2c3b4d5e',
  })
  request_id?: string;

  @ApiPropertyOptional({
    description:
      'Structured, error-specific context. Validation failures expose ' +
      '`fields`.',
    type: 'object',
    additionalProperties: true,
  })
  details?: Record<string, unknown>;
}
