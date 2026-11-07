import { ApiProperty } from '@nestjs/swagger';

/**
 * Error envelope emitted by `GlobalExceptionFilter` for every failed request.
 *
 * Mirrors the payload built by `buildErrorResponse`; keep both in sync.
 */
export class ApiErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code. Always matches the response status line.',
    example: 400,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'ISO-8601 timestamp of when the error response was rendered.',
    example: '2026-01-01T00:00:00.000Z',
    format: 'date-time',
    type: String,
  })
  timestamp!: string;

  @ApiProperty({
    description: 'Request path, including the global `v1` prefix.',
    example: '/v1/documents',
  })
  path!: string;

  @ApiProperty({
    description:
      'HTTP error name. Also used as the stable key of the documented example.',
    example: 'Bad Request',
  })
  error!: string;

  @ApiProperty({
    description:
      'Stable machine-readable error code in `UPPER_SNAKE_CASE`. ' +
      'Derived from the domain error code, the exception payload, or the ' +
      'HTTP status fallback; internal class names are never exposed.',
    example: 'DOCUMENT_NOT_FOUND',
  })
  code!: string;

  @ApiProperty({
    description:
      'Human-readable error message. Validation failures return one entry ' +
      'per invalid field instead of a single string.',
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: 'string' } },
    ],
    example: ['title should not be empty'],
  })
  message!: string | string[];
}
