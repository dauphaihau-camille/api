# Camille API Service

Service-local guide for the NestJS API under [api/](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api). Use the workspace [README.md](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/README.md) for repo-level setup, local infrastructure, and runtime modes.

## Structure

- `src/bootstrap/` - API and worker entrypoints, composition roots
- `src/platform/` - config, logging, request context, observability, health, transport plumbing
- `src/domains/` - business modules such as `auth`, `workspace`, `document`, `user`
- `src/integrations/` - technical adapters such as cache, queue, mail, storage, payment, AI
- `src/shared/` - small generic primitives only

Domain modules generally follow:

```text
<domain>/
├── api/
├── app/
├── domain/
├── infra/
└── *.module.ts
```

## Commands

Run these from `api/`:

```bash
pnpm install
pnpm run db:migration:up
pnpm run db:seed
pnpm run db:seed:demo
pnpm run start:dev
pnpm run start:worker:dev
pnpm test
pnpm test:e2e
pnpm test:int
pnpm test:hurl
```

## Runtime

- API entrypoint: `src/bootstrap/index.ts`
- Worker entrypoint: `src/bootstrap/worker.ts`
- App module: `src/bootstrap/app.module.ts`
- REST base: `/`
- GraphQL: `/graphql`
- Docs: `/docs`
- OpenAPI JSON: `/docs/openapi.json`
- Metrics: `/metrics`
- Health: `/health`
- Readiness: `/health/ready`

## Main Environment Variables

- Core: `PORT`, `NODE_ENV`, `CORS_ALLOWED_ORIGINS`
- Database: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Auth: `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_TTL`
- Cache: `REDIS_URL`, `CACHE_DRIVER`, `CACHE_TTL`
- Rate limit: `RATE_LIMIT_DRIVER`, `RATE_LIMIT_LIMIT`, `RATE_LIMIT_TTL`, `RATE_LIMIT_BLOCK_DURATION`
- Queue: `QUEUE_DRIVER`, `QUEUE_REDIS_URL`, `QUEUE_WORKER_CONCURRENCY`
- Mail: `MAIL_DRIVER`, `MAIL_DEFAULT_FROM_EMAIL`, `MAIL_DEFAULT_FROM_NAME`, `RESEND_API_KEY`
- Payment: `PAYMENT_PUBLIC_BASE_URL`, `PAYMENT_WEBHOOK_SECRET`
- Storage: `STORAGE_DRIVER`, `STORAGE_LOCAL_ROOT`, `STORAGE_PUBLIC_BASE_URL`, `STORAGE_OBJECT_STORAGE_*`

Defaults worth knowing:

- cache and rate limiting default to `memory` in tests and Redis elsewhere
- queue defaults to `inline` in tests and Redis elsewhere
- `RESEND_API_KEY` is required only when `MAIL_DRIVER=resend`
- `STORAGE_OBJECT_STORAGE_*` is the preferred object-storage naming

## Main Capabilities

- JWT and cookie-backed auth with RBAC foundations
- PostgreSQL via MikroORM migrations and seeds
- Redis-backed cache, rate limiting, and background jobs
- provider seams for mail, payment, storage, notification, and AI
- SSE and WebSocket transport foundations
- request-context-aware audit logging

## Seed and Database Notes

- Migrations live in [database/migrations](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/database/migrations)
- Seed assets live in [seed-data](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/seed-data)
- Useful commands:

```bash
pnpm run db:migration:create
pnpm run db:migration:up
pnpm run db:migration:down
pnpm run db:seed
pnpm run db:seed:demo
pnpm run db:seed:huge
pnpm run db:seed:realistic
```

## Further Reading

- [test/README.md](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/test/README.md)
- [docs/project-structure.md](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/docs/project-structure.md)
- [docs/layered-error-model.md](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/docs/layered-error-model.md)
- [seed-data/README.md](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/seed-data/README.md)
