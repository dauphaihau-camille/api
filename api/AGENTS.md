# API Agent Index

Read only the files relevant to the task.

- `agent-skills/common-rules.md` - cross-cutting coding rules for all API changes
- `agent-skills/src-structure.md` - source ownership and placement rules under `src/`
- `agent-skills/http-api-conventions.md` - HTTP API contract naming and DTO boundary rules
- `agent-skills/layered-error-model.md` - when to use domain errors vs application errors and where transport mapping belongs
- `agent-skills/cross-domain-boundaries.md` - cross-domain collaboration rules and forbidden infra leakage patterns
- `agent-skills/repository-conventions.md` - repository split and persistence-boundary rules
- `agent-skills/use-case-boundaries.md` - when to use a use case versus a service
- `agent-skills/testing.md` - verification expectations and test placement

## API Contract

`openapi.json` in this directory is a committed artifact generated from the
compiled build (`dist/`) in Nest preview mode. Generating it must not require a
database, Redis, MinIO, or Mongo.

```bash
pnpm spec:generate
pnpm spec:generate -- --check
```

- Run `pnpm spec:generate` after any DTO or controller change, and keep
  `pnpm spec:generate -- --check` clean before merge. The document is assembled
  by `createApiDocument` in `src/platform/docs/setup-api-docs.ts`; the `/v1`
  prefix comes from `API_GLOBAL_PREFIX` in
  `src/platform/http/api-global-prefix.ts`.
- The spec is emitted verbatim, so wire casing follows the DTO declarations.
- Failure responses use the fixed snake_case envelope emitted by
  `GlobalExceptionFilter`:
  `{ status_code, code, message, request_id?, details? }`. `message` is always
  a string and `code` is the stable machine-readable code; `request_id` mirrors
  the `X-Request-Id` response header. Structured, error-specific context (mapper
  extras and payload `details`) is emitted under `details`; nothing else is
  ever added at the top level and the legacy `timestamp`/`path` fields are gone.
  Validation failures use `code: 'VALIDATION_FAILED'`, `message: 'Validation
  failed'` and `details.fields: [{ field, messages }]`, with snake_case field
  paths. Document them with
  `@ApiErrorResponses({ [status]: ApiErrorExample[] })` from
  `src/platform/http/api-error-responses.decorator.ts`, reusing the examples in
  `src/platform/http/api-error-examples.ts` (every `ApiErrorExample` requires a
  `code` and a string `message`, and may carry `details`). Platform owns only
  the cross-cutting examples there — validation (`400`), internal
  (`500`) and rate limit (`429`). The guard failures are owned by the auth
  domain: `unauthorizedErrorExample` (the `401` `JwtAuthGuard` produces) and
  `forbiddenErrorExample` (the `403` `PermissionsGuard` produces) live in
  `src/domains/auth/api/rest/auth-error-examples.ts`. Domain-specific
  examples live next to the controllers that use them, in
  `src/domains/<domain>/api/rest/<domain>-error-responses.ts`. Declare only
  statuses the controller can actually produce: always `500`, plus `401`/`403`
  when a guard protects the route, `400` when a handler consumes a DTO, and
  `404`/`409` only when an error mapper proves them.
- `createApiDocument` runs a completion pass after scanning routes: every
  declared numeric error response on a `/v1` operation that has no content
  gains the shared `ApiErrorResponseDto` schema plus a generic fallback
  example whose `status_code` matches the response and whose `code` is the
  status fallback. A response that already uses the shared schema but carries
  neither `example` nor `examples` gains the same fallback example. Authored
  examples and `$ref` responses are never touched, and no status is ever
  invented. This keeps hand-declared statuses documented without repeating the
  payload in every controller.
- Operation IDs are unique per route:
  `${controllerKey.replace(/_?Controller$/, '')}_${methodKey}`. Controller
  method names repeat across domains (`create`, `list`, `cancel`), and
  generated clients and contract diffs key on the operation ID.
- Prefer **method-level** declarations so each route documents the domain codes
  its mapper actually emits (`DOCUMENT_NOT_FOUND`, `INVALID_CREDENTIALS`,
  `WORKSPACE_BLOCK_LIMIT_REACHED`, ...). Import the domain example that
  matches the mapper's message from the domain's own `*-error-responses.ts`
  instead of the generic status example.
  Keep a class-level declaration only for statuses shared by every route in the
  controller: `429` with `tooManyRequestsErrorExample`, because the global
  `ThrottlerGuard` protects all domain controllers.
- Adding a method-level `@ApiErrorResponses` replaces Nest's implicit success
  response for that handler. If the route has no explicit `@ApiOkResponse` /
  `@ApiCreatedResponse` / `@ApiNoContentResponse`, add one so the success status
  does not disappear from the contract.
- `code` is always `UPPER_SNAKE_CASE` and resolved by
  `src/platform/http/api-error-code.ts` in this order:
  1. a string `code` already present on the HTTP exception payload, when it is
     already canonical `UPPER_SNAKE_CASE`;
  2. the code preserved by the domain HTTP error mapper: every
     `*-http-error-mapper.ts` builds its exception payload with
     `toHttpErrorPayload(error, details?)`, which derives the code from the domain
     error's `code` (`DocumentNotFoundError` -> `DOCUMENT_NOT_FOUND`,
     `workspace_block_limit_reached` -> `WORKSPACE_BLOCK_LIMIT_REACHED`) and
     carries any structured context in `details`;
  3. the status fallback below.
  Internal exception class names are never emitted as codes.

  | Status | Fallback code          |
  | ------ | ---------------------- |
  | 400    | `BAD_REQUEST`          |
  | 401    | `UNAUTHORIZED`         |
  | 403    | `FORBIDDEN`            |
  | 404    | `NOT_FOUND`            |
  | 405    | `METHOD_NOT_ALLOWED`   |
  | 409    | `CONFLICT`             |
  | 422    | `UNPROCESSABLE_ENTITY` |
  | 429    | `RATE_LIMIT_EXCEEDED`  |
  | 500    | `INTERNAL_SERVER_ERROR` |
  | 501    | `NOT_IMPLEMENTED`      |
  | 503    | `SERVICE_UNAVAILABLE`  |
  | 504    | `GATEWAY_TIMEOUT`      |

  Any other 4xx falls back to `BAD_REQUEST`; any other status falls back to
  `INTERNAL_SERVER_ERROR`.
- `openapi.json` takes `info.version` from `packages/api-spec/package.json`
  (`scripts/generate-openapi.ts`). Bump the manifest first, then regenerate;
  never hardcode the version in `setup-api-docs.ts`.
- `createApiDocument` completes the document metadata that consumers and the
  lint gate rely on: every discovered tag gets the description from
  `TAG_DESCRIPTIONS` in `src/platform/docs/setup-api-docs.ts` (add an entry
  when a new `@ApiTags` name appears), and `info.license` is `UNLICENSED` to
  match `packages/api-spec/package.json`. `redocly.yaml` holds only documented
  exceptions to `pnpm spec:lint`; each one names the components or operations
  it covers and why the generated document cannot satisfy the rule.
- Every DTO property must carry an explicit `@ApiProperty` or
  `@ApiPropertyOptional` annotation. The `@nestjs/swagger` CLI plugin is
  intentionally disabled, so TypeScript types, class-validator decorators, and
  comments are never inferred into the contract.
- `@dauphaihau-camille/api-spec` is the published contract. `pnpm spec:package`
  copies `openapi.json` into `packages/api-spec/openapi.json` byte for byte
  (gitignored); `pnpm spec:package -- --check` fails when the copy is stale.
- Bump `packages/api-spec/package.json` by hand: ERR-level breaking change ->
  major, WARN or additive structural change -> minor, documentation-only ->
  patch. `pnpm contract:check` enforces the rule locally.
- Pull request CI runs the same gate (`.github/workflows/ci.yml`: the `validate`
  job plus a `contract` job) before merge; `publish-api-spec.yml` publishes from
  `production` after that gate passes.
