import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { DocumentBuilder, getSchemaPath, SwaggerModule } from '@nestjs/swagger';
import { resolveErrorCode } from '../http/api-error-code';
import { ApiErrorResponseDto } from '../http/api-error-response.dto';
import { API_GLOBAL_PREFIX } from '../http/api-global-prefix';

const DOCS_PATH = '/docs';
const OPENAPI_JSON_PATH = `${DOCS_PATH}/openapi.json`;
const BUSINESS_PATH_PREFIX = `/${API_GLOBAL_PREFIX}/`;
type DocumentTag = { name: string; description?: string };
type TaggedOperation = { tags?: string[] };

function renderScalarDocument(openApiUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nest Template API Reference</title>
    <style>
      body {
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '${openApiUrl}',
      })
    </script>
  </body>
</html>`;
}

function sortDocumentTags(document: OpenAPIObject): void {
  const existingTags = new Map<string, DocumentTag>();

  for (const tag of document.tags ?? []) {
    existingTags.set(tag.name, tag);
  }

  const discoveredTagNames = new Set<string>();

  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const operation of Object.values(pathItem ?? {})) {
      if (!operation || typeof operation !== 'object' || !('tags' in operation)) {
        continue;
      }

      for (const tagName of ((operation as TaggedOperation).tags ?? []).filter(Boolean)) {
        discoveredTagNames.add(tagName);
      }
    }
  }

  document.tags = [...discoveredTagNames]
    .sort((left, right) => left.localeCompare(right))
    .map((name) => existingTags.get(name) ?? { name });
}

function restrictToGlobalPrefix(document: OpenAPIObject): void {
  const prefix = `/${API_GLOBAL_PREFIX}/`;

  for (const documentPath of Object.keys(document.paths ?? {})) {
    if (!documentPath.startsWith(prefix)) {
      delete document.paths?.[documentPath];
    }
  }
}

/**
 * Completes already-declared numeric error responses on business JSON
 * operations.
 *
 * Only responses an endpoint has authored (via `@ApiResponse` or the shared
 * `ApiErrorResponses` decorator) are touched: a declared error response without
 * content gains the shared envelope schema and a generic fallback example, and
 * a declared response that uses the shared envelope schema but carries neither
 * an example nor named examples gains the generic fallback example. Authored
 * `$ref` responses and authored examples are left untouched, and no error status
 * is ever invented. Operational endpoints outside the business prefix (health,
 * metrics, queue UI) are ignored.
 */
function completeDeclaredErrorResponses(document: OpenAPIObject): void {
  const schemaRef = { $ref: getSchemaPath(ApiErrorResponseDto) };
  const fallbackExample = (statusCode: number) => ({
    status_code: statusCode,
    code: resolveErrorCode(statusCode),
    message: STATUS_CODES[statusCode] ?? 'Request failed',
  });
  const errorContent = (statusCode: number) => ({
    'application/json': {
      schema: schemaRef,
      example: fallbackExample(statusCode),
    },
  });

  for (const [documentPath, pathItem] of Object.entries(document.paths ?? {})) {
    if (!documentPath.startsWith(BUSINESS_PATH_PREFIX)) {
      continue;
    }

    for (const operation of Object.values(pathItem ?? {})) {
      if (!operation || typeof operation !== 'object' || !('responses' in operation)) {
        continue;
      }

      const rawResponses = operation.responses;

      if (!rawResponses || typeof rawResponses !== 'object') {
        continue;
      }

      const operationResponses = rawResponses as Record<string, unknown>;

      for (const [status, response] of Object.entries(operationResponses)) {
        const statusCode = Number(status);

        if (
          statusCode >= 400
          && response
          && typeof response === 'object'
          && !('$ref' in response)
        ) {
          const errorResponse = response as Record<string, unknown>;
          errorResponse.content ??= errorContent(statusCode);
          const content = errorResponse.content as Record<string, {
            schema?: { $ref?: string };
            example?: unknown;
            examples?: unknown;
          }>;
          const json = content['application/json'];

          if (
            json?.schema?.$ref === schemaRef.$ref
            && json.example === undefined
            && json.examples === undefined
          ) {
            json.example = fallbackExample(statusCode);
          }
        }
      }
    }
  }
}

export function createApiDocument(app: INestApplication): OpenAPIObject {
  const accessCookieName = process.env.AUTH_COOKIE_ACCESS_NAME ?? 'accessToken';
  const refreshCookieName = process.env.AUTH_COOKIE_REFRESH_NAME ?? 'refreshToken';
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Camille API')
      .setDescription('REST API reference for the Camille backend.')
      .setVersion('1.0.0')
      .addSecurity('accessCookie', {
        type: 'apiKey',
        in: 'cookie',
        name: accessCookieName,
        description: `Session access token cookie (${accessCookieName}).`,
      })
      .addSecurity('refreshCookie', {
        type: 'apiKey',
        in: 'cookie',
        name: refreshCookieName,
        description: `Session refresh token cookie (${refreshCookieName}).`,
      })
      .build(),
    {
      deepScanRoutes: true,
      // Controller method names repeat across domains (`create`, `list`,
      // `cancel`), so a bare method key is not unique. Consumers key on
      // operation IDs (generated clients, diffs), which requires uniqueness.
      operationIdFactory: (controllerKey: string, methodKey: string) =>
        `${controllerKey.replace(/_?Controller$/, '')}_${methodKey}`,
      extraModels: [ApiErrorResponseDto],
    },
  );

  restrictToGlobalPrefix(document);
  sortDocumentTags(document);
  completeDeclaredErrorResponses(document);

  return document;
}

export function setupApiDocs(app: INestApplication): void {
  const httpAdapter = app.getHttpAdapter().getInstance();
  const document = createApiDocument(app);

  SwaggerModule.setup(DOCS_PATH, app, document, {
    ui: false,
    raw: ['json'],
    jsonDocumentUrl: OPENAPI_JSON_PATH,
  });

  httpAdapter.get(DOCS_PATH, (_request: Request, response: Response) => {
    response
      .type('html')
      .send(renderScalarDocument(OPENAPI_JSON_PATH));
  });
}
