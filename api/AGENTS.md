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
- `@dauphaihau-camille/api-spec` is the published contract. `pnpm spec:package`
  copies `openapi.json` into `packages/api-spec/openapi.json` byte for byte
  (gitignored); `pnpm spec:package -- --check` fails when the copy is stale.
- Bump `packages/api-spec/package.json` by hand: ERR-level breaking change ->
  major, WARN or additive structural change -> minor, documentation-only ->
  patch. `pnpm contract:check` enforces the rule locally.
- Pull request CI runs the same gate (`.github/workflows/ci.yml`: the `validate`
  job plus a `contract` job) before merge; `publish-api-spec.yml` publishes from
  `production` after that gate passes.
