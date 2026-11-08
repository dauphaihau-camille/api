import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '~/platform/http/api-error-response.dto';

/** A single named error the endpoint can return at a given status. */
export interface ApiErrorExample {
  /** Stable machine-readable code emitted in the `code` field. */
  code: string;
  /** Value emitted in the `message` field. */
  message: string | string[];
}

const EXAMPLE_TIMESTAMP = '2026-01-01T00:00:00.000Z';
const EXAMPLE_PATH = '/v1/resource';

function describeExample(example: ApiErrorExample | undefined): string {
  if (!example) {
    return 'Error response.';
  }

  return Array.isArray(example.message)
    ? example.message.join(', ')
    : example.message;
}

/**
 * Documents endpoint-specific public error responses on a controller class
 * (applies to every method) or on a single route handler.
 *
 * Each numeric key is an HTTP status; every example becomes a named media
 * example keyed by its `code`, using the shared error envelope
 * (`ApiErrorResponseDto`). The envelope `statusCode` is derived from the
 * numeric key so authors never restate it.
 */
export function ApiErrorResponses(
  responses: Readonly<Record<number, readonly ApiErrorExample[]>>,
): ClassDecorator & MethodDecorator {
  const declarations = Object.entries(responses)
    .map(([status, examples]) => ({ status: Number(status), examples }))
    .filter(({ examples }) => examples.length > 0)
    .map(({ status, examples }) => {
      const [primary] = examples;

      return ApiResponse({
        status,
        description: describeExample(primary),
        content: {
          'application/json': {
            schema: { $ref: getSchemaPath(ApiErrorResponseDto) },
            examples: Object.fromEntries(
              examples.map((example) => [
                example.code,
                {
                  summary: example.code,
                  value: {
                    statusCode: status,
                    timestamp: EXAMPLE_TIMESTAMP,
                    path: EXAMPLE_PATH,
                    code: example.code,
                    message: example.message,
                  },
                },
              ]),
            ),
          },
        },
      });
    });

  return applyDecorators(
    ApiExtraModels(ApiErrorResponseDto),
    ...declarations,
  );
}
