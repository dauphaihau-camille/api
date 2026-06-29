# Nest Template Workspace

Opinionated NestJS backend starter for projects that are expected to grow into a more structured, scalable service. This workspace is not meant to be a minimal boilerplate. It is meant to show the shape of a backend that already has clear boundaries, operational defaults, and room to scale.

## What This Starter Optimizes For

- Modular monolith structure with explicit domain and shared-module boundaries
- JWT authentication and RBAC as first-class backend concerns
- REST and GraphQL living side by side in one codebase
- PostgreSQL with MikroORM, migrations, and seed data
- Redis-backed cache and rate limiting
- Redis-backed background jobs and worker process
- Mail and storage abstractions with swappable infrastructure adapters
- Tests and request tooling that make common flows easy to validate

This is a good fit when the project will likely need auth, permissions, operational controls, and multiple transport surfaces early or soon after initial delivery.

## Workspace Layout

- `api/`
  Main NestJS backend starter. This is the template most projects will copy and adapt.
- `infra/`
  Local infrastructure used by the starter during development.
- `tools/api-request/`
  Hurl request files and helper scripts for manual API flow testing.
- `tools/mcp/`
  Stdio MCP server that reuses parts of the template for local tooling.
- `justfile`
  Root task entrypoint for common workspace commands.

## Included by Design

The starter intentionally includes more than a minimal app:

- auth module
- RBAC foundations
- user management example flows
- REST controllers
- GraphQL resolvers
- health checks
- cache module
- rate limiting
- queue and worker foundation
- mail module
- storage module

Some projects may trim modules later. They are included here so teams can start from a backend shape that already reflects common scale concerns instead of rediscovering those boundaries ad hoc.

## Getting Started

Start local infrastructure:

```bash
just infra-up
```

Install API dependencies:

```bash
just api-install
```

Configure environment:

```bash
cp api/.env.example api/.env
```

Run the API:

```bash
just api-up
```

Run the background worker:

```bash
just api-worker-up
```

Apply migrations and seed baseline data:

```bash
just api-migration-up
just db-seed
```

## Common Commands

Run tests:

```bash
cd api
pnpm test
pnpm test:e2e
```

There is also a template-safe k6 login load example under [api/test/performance](/Volumes/Local/dev/pj-personal/templates/api/nest-template/api/test/performance/k6/login.load.js) for quick local performance smoke checks.

## Documentation

- See [api/README.md](/Volumes/Local/dev/pj-personal/templates/api/nest-template/api/README.md) for setup details, module behavior, environment variables, migrations, and default endpoints.
- Use this root README to understand the intent and scope of the workspace.

## Notes

- The root repository owns the full workspace history.
- `api/` is no longer a standalone git repository.
- The auth e2e suite creates and destroys a temporary PostgreSQL database per run, but still expects local PostgreSQL to be available.
- `tools/mcp/` loads environment variables from `api/.env` by default so it stays aligned with the backend template configuration.
- `scripts/codex-with-mcp.sh` injects the `nest-template` MCP server only for Codex sessions started from this repository.
