import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import OpenAPIResponseValidator from 'openapi-response-validator';
import type { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import type { OpenAPIV3 } from 'openapi-types';

/**
 * Runtime conformance against the committed `openapi.json`.
 *
 * The e2e suites assert concrete response bodies with this helper so the
 * generated contract is proven to describe what the API actually emits.
 */

export type ContractHttpMethod =
  | 'delete'
  | 'get'
  | 'head'
  | 'options'
  | 'patch'
  | 'post'
  | 'put';

export type ContractResponseAssertion = {
  /** Accepts either casing, e.g. `post` or `POST`. */
  method: ContractHttpMethod | Uppercase<ContractHttpMethod>;
  /** Concrete request URL, e.g. `/v1/documents/9f3c...`. Query strings are ignored. */
  path: string;
  status: number;
  body: unknown;
};

type ValidationIssue = {
  path?: string;
  message: string;
};

const SPEC_FILE_NAME = 'openapi.json';

const OPERATION_METHODS: readonly ContractHttpMethod[] = [
  'delete',
  'get',
  'head',
  'options',
  'patch',
  'post',
  'put',
];

let cachedDocument: OpenAPIV3.Document | undefined;

const validators = new Map<string, OpenAPIResponseValidator>();

export class ContractViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractViolationError';
  }
}

function parseDocument(specPath: string): OpenAPIV3.Document {
  const parsed: unknown = JSON.parse(readFileSync(specPath, 'utf8'));

  if (parsed === null || typeof parsed !== 'object') {
    throw new ContractViolationError(`${specPath} does not contain a JSON object.`);
  }

  if (!('openapi' in parsed) || typeof parsed.openapi !== 'string') {
    throw new ContractViolationError(
      `${specPath} is not an OpenAPI document: missing the "openapi" field.`,
    );
  }

  if (
    !('paths' in parsed)
    || parsed.paths === null
    || typeof parsed.paths !== 'object'
  ) {
    throw new ContractViolationError(
      `${specPath} is not an OpenAPI document: missing the "paths" object.`,
    );
  }

  // The structural invariants above cover the fields this helper reads.
  return parsed as OpenAPIV3.Document;
}

export function loadOpenApiDocument(): OpenAPIV3.Document {
  if (!cachedDocument) {
    const candidates = [
      process.env.OPENAPI_SPEC_PATH,
      resolve(process.cwd(), SPEC_FILE_NAME),
      resolve(__dirname, '..', '..', SPEC_FILE_NAME),
    ].filter(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.trim().length > 0,
    );

    const specPath = candidates.find((candidate) => existsSync(candidate));

    if (!specPath) {
      throw new ContractViolationError(
        `Unable to locate ${SPEC_FILE_NAME}. Looked in: ${candidates.join(', ')}`,
      );
    }

    cachedDocument = parseDocument(specPath);
  }

  return cachedDocument;
}

const splitUrlSegments = (url: string): string[] =>
  url
    .split(/[?#]/u, 1)[0]
    .split('/')
    .filter((segment) => segment.length > 0);

const isTemplateSegment = (segment: string): boolean =>
  segment.startsWith('{') && segment.endsWith('}');

const matchesTemplate = (templateSegments: string[], urlSegments: string[]): boolean =>
  templateSegments.length === urlSegments.length
  && templateSegments.every((segment, index) => {
    const urlSegment = urlSegments[index] ?? '';

    return isTemplateSegment(segment)
      ? urlSegment.length > 0
      : segment === decodeURIComponent(urlSegment);
  });

/**
 * Resolves a concrete URL such as `/v1/documents/abc` to the registered
 * template such as `/v1/documents/{documentId}`.
 */
export function resolveOperationPath(url: string, document = loadOpenApiDocument()): string {
  const urlSegments = splitUrlSegments(url);

  if (urlSegments.length === 0) {
    throw new ContractViolationError(`Cannot resolve an empty path: "${url}".`);
  }

  const literalPath = `/${urlSegments.join('/')}`;

  if (typeof document.paths[literalPath] === 'object') {
    return literalPath;
  }

  const matches = Object.keys(document.paths)
    .map((template) => {
      const segments = splitUrlSegments(template);

      return {
        segments,
        template,
        staticSegments: segments.filter((segment) => !isTemplateSegment(segment)).length,
      };
    })
    .filter(({ segments }) => matchesTemplate(segments, urlSegments))
    .sort((left, right) => right.staticSegments - left.staticSegments);

  const bestMatch = matches[0];

  if (!bestMatch) {
    throw new ContractViolationError(`No registered OpenAPI path matches "${url}".`);
  }

  return bestMatch.template;
}

function resolveOperation(
  method: ContractHttpMethod,
  pathTemplate: string,
  document: OpenAPIV3.Document,
): OpenAPIV3.OperationObject {
  const pathItem = document.paths[pathTemplate];

  if (!pathItem) {
    throw new ContractViolationError(`No registered OpenAPI path for "${pathTemplate}".`);
  }

  const operation = pathItem[method];

  if (!operation) {
    throw new ContractViolationError(
      `OpenAPI path "${pathTemplate}" does not define the ${method.toUpperCase()} operation.`,
    );
  }

  return operation;
}

function getValidator(
  key: string,
  responses: OpenAPIV3.ResponsesObject,
  document: OpenAPIV3.Document,
): OpenAPIResponseValidator {
  const existing = validators.get(key);

  if (existing) {
    return existing;
  }

  const validator = new OpenAPIResponseValidator({
    components: document.components,
    // The package accepts full OpenAPI 3.0 ResponseObjects here even though its
    // argument type only advertises the Swagger-style `{ schema }` shape.
    responses: responses as unknown as OpenAPIResponseValidatorArgs['responses'],
  });

  validators.set(key, validator);

  return validator;
}

function toIssues(errors: unknown): ValidationIssue[] {
  if (!Array.isArray(errors)) {
    return [];
  }

  const issues: ValidationIssue[] = [];

  for (const error of errors) {
    if (error === null || typeof error !== 'object') {
      continue;
    }

    const message =
      'message' in error && typeof error.message === 'string'
        ? error.message
        : 'is invalid';
    const path =
      'path' in error && typeof error.path === 'string' && error.path.length > 0
        ? error.path
        : undefined;

    issues.push({ message, path });
  }

  return issues;
}

function describeIssues(issues: ValidationIssue[]): string {
  const [first] = issues;

  if (!first) {
    return 'response did not match the documented schema';
  }

  const detail = first.path ? `${first.path}: ${first.message}` : first.message;
  const extra = issues
    .slice(1, 4)
    .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message));
  const remaining = issues.length - 1 - extra.length;

  if (extra.length === 0) {
    return detail;
  }

  const suffix = remaining > 0 ? `, and ${remaining} more` : '';

  return `${detail} (also ${extra.join('; ')}${suffix})`;
}

/**
 * Asserts that a concrete response body matches the committed contract.
 * Throws `ContractViolationError` naming the method, path, status and the
 * first validation error on mismatch.
 */
export function assertMatchesContract(assertion: ContractResponseAssertion): void {
  const method = OPERATION_METHODS.find(
    (candidate) => candidate === assertion.method.toLowerCase(),
  );

  if (!method) {
    throw new ContractViolationError(
      `Unsupported HTTP method "${String(assertion.method)}".`,
    );
  }

  const document = loadOpenApiDocument();
  const pathTemplate = resolveOperationPath(assertion.path, document);
  const operation = resolveOperation(method, pathTemplate, document);
  const validator = getValidator(
    `${method} ${pathTemplate}`,
    operation.responses,
    document,
  );

  // Documented responses without a body (e.g. 204) are validated against a
  // `null` payload.
  const isEmptyPayload =
    assertion.body === undefined
    || assertion.body === null
    || assertion.body === ''
    || (typeof assertion.body === 'object'
      && assertion.body !== null
      && !Array.isArray(assertion.body)
      && Object.keys(assertion.body).length === 0);
  const result: unknown = validator.validateResponse(
    assertion.status,
    isEmptyPayload ? null : assertion.body,
  );

  if (result === undefined) {
    return;
  }

  const issues = toIssues(
    result !== null && typeof result === 'object' && 'errors' in result
      ? result.errors
      : undefined,
  );
  const subject = `${method.toUpperCase()} ${assertion.path} (status ${assertion.status})`;

  throw new ContractViolationError(
    `Response for ${subject} does not match OpenAPI path "${pathTemplate}": ${describeIssues(issues)}`,
  );
}

/**
 * Jest-friendly alias. Reads like an assertion inside `it(...)` blocks and
 * throws the same `ContractViolationError` on mismatch.
 */
export function expectMatchesContract(assertion: ContractResponseAssertion): void {
  assertMatchesContract(assertion);
}
