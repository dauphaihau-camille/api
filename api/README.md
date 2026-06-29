# API Template

Opinionated NestJS backend starter for services that are expected to grow beyond a minimal CRUD app. This package is intentionally not a bare Nest scaffold. It includes the backend concerns that commonly appear once a project starts scaling in scope, team size, and operational requirements.

## Included by Default

- JWT authentication
- RBAC foundations
- user registration, login, refresh, logout, and current-user flows
- user management example module
- REST controllers
- GraphQL resolvers
- PostgreSQL with MikroORM
- migrations and seed data
- Redis-backed cache
- Redis-backed rate limiting
- Redis-backed background jobs
- AI abstraction
- audit logging foundation
- mail abstraction
- notification abstraction
- payment provider abstraction
- SSE foundation
- storage abstraction
- websocket foundation
- health checks

Some projects will trim parts of this later. They are included here so the starting point already reflects a scalable backend shape.

## Architecture

This template follows a pragmatic modular-monolith structure:

- `src/modules/domains/*`
  Domain-oriented modules such as `auth` and `user`
- `src/modules/shared/*`
  Shared modules such as AI, audit, cache, health, request context, queue, rate limiting, mail, notification, payment, SSE, storage, and websocket transport
- `src/common/*`
  Shared cross-cutting concerns such as decorators, events, filters, interceptors, and pipes
- `src/config/*`
  Environment parsing and configuration builders

The codebase aims for:

- thin transport layers
- explicit application use cases
- repository boundaries around persistence
- events for side effects
- implementation details hidden behind ports or module boundaries

## Local Infrastructure

The workspace includes local PostgreSQL, Redis, and object-storage-related infrastructure in [infra/docker-compose.yml](/Volumes/Local/dev/pj-personal/templates/api/nest-template/infra/docker-compose.yml).

Start local services from the workspace root:

```bash
just infra-up
```

Or run Docker Compose directly:

```bash
docker compose -f ../infra/docker-compose.yml up -d
```

## Setup

Install dependencies:

```bash
pnpm install
```

Create the local environment file:

```bash
cp .env.example .env
```

Run migrations:

```bash
pnpm run db:migration:up
```

Seed reference auth and RBAC data:

```bash
pnpm run db:seed
```

Seed demo users as well:

```bash
pnpm run db:seed:demo
```

Start the app:

```bash
pnpm run start:dev
```

Start the background worker:

```bash
pnpm run start:worker:dev
```

The API listens on `PORT`. REST endpoints are served from the root path, and GraphQL is served at `/graphql`.

## Tests

Common test commands:

```bash
pnpm test
pnpm test:e2e
pnpm test:int
pnpm test:hurl
```

E2E specs live under `test/e2e/`, shared test helpers live under `test/support/`, and the e2e Jest config stays in `test/jest-e2e.json`.

The template also includes a lightweight k6 load-test example for the login flow:

```bash
BASE_URL=http://127.0.0.1:3000/v1 \
LOGIN_EMAIL=member@example.com \
LOGIN_PASSWORD=Password123! \
k6 run ./test/performance/k6/login.load.js
```

Optional environment variables:

- `SCENARIO=normal-traffic.json`
- `K6_VUS=5`
- `K6_DURATION=30s`

The default scenario file is [test/performance/scenarios/normal-traffic.json](/Volumes/Local/dev/pj-personal/templates/api/nest-template/api/test/performance/scenarios/normal-traffic.json).

## Environment Variables

The current environment contract is validated at boot. The most important variables are:

### Core App

- `PORT`
- `NODE_ENV`
- `CORS_ALLOWED_ORIGINS`

`CORS_ALLOWED_ORIGINS` is a comma-separated allowlist. Example:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3001,http://localhost:5173
```

### Database

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

PostgreSQL is the default and only database driver currently configured.

### Auth

- `JWT_ACCESS_SECRET`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_SECRET`
- `JWT_REFRESH_TTL`
- `AUTH_COOKIE_ACCESS_NAME`
- `AUTH_COOKIE_REFRESH_NAME`
- `AUTH_COOKIE_DOMAIN`
- `AUTH_COOKIE_PATH`
- `AUTH_COOKIE_SAME_SITE`
- `AUTH_COOKIE_SECURE`
- `BCRYPT_SALT_ROUNDS`

The template supports both bearer-token auth and http-only auth cookies for access and refresh tokens. Auth endpoints still return tokens in the response body, and they now also set auth cookies by default.

### Cache

- `REDIS_URL`
- `CACHE_DRIVER`
- `CACHE_TTL`

Supported cache drivers:

- `memory`
- `redis`

If `CACHE_DRIVER` is omitted, tests default to memory and non-test environments default to Redis.

### Rate Limiting

- `RATE_LIMIT_DRIVER`
- `RATE_LIMIT_LIMIT`
- `RATE_LIMIT_TTL`
- `RATE_LIMIT_BLOCK_DURATION`

Supported rate-limit drivers:

- `memory`
- `redis`

If `RATE_LIMIT_DRIVER` is omitted, tests default to memory and non-test environments default to Redis.

### Queue

- `QUEUE_DRIVER`
- `QUEUE_NAME`
- `QUEUE_PREFIX`
- `QUEUE_REDIS_URL`
- `QUEUE_JOB_ATTEMPTS`
- `QUEUE_JOB_BACKOFF`
- `QUEUE_REMOVE_COMPLETED_AFTER`
- `QUEUE_REMOVE_FAILED_AFTER`
- `QUEUE_WORKER_CONCURRENCY`

Supported queue drivers:

- `inline`
- `redis`

If `QUEUE_DRIVER` is omitted, tests default to inline and non-test environments default to Redis.

### Mail

- `MAIL_DRIVER`
- `MAIL_DEFAULT_FROM_EMAIL`
- `MAIL_DEFAULT_FROM_NAME`
- `RESEND_API_KEY`

Supported mail drivers:

- `logger`
- `resend`

`RESEND_API_KEY` is required only when `MAIL_DRIVER=resend`.

### AI

- `AI_DEFAULT_TEXT_MODEL`
- `AI_DEFAULT_EMBEDDING_MODEL`

The template includes a provider-neutral AI seam through `AiService` and `AiProvider`. It supports two generic operations by default: text generation and embeddings.

The shipped `NoopAiProvider` is intentionally non-production. It exists so projects can add an OpenAI, Anthropic, Google, Ollama, or internal provider adapter without changing module boundaries later.

### Payment

- `PAYMENT_PUBLIC_BASE_URL`
- `PAYMENT_WEBHOOK_SECRET`
- `PAYMENT_SUCCESS_PATH`
- `PAYMENT_CANCEL_PATH`

The template does not ship a real payment integration by default. It includes a shared payment-provider seam so projects can add Stripe, Paddle, Lemon Squeezy, or an internal billing adapter without redesigning module boundaries later.

The default `NoopPaymentProvider` is intentionally non-production. It is suitable only as a placeholder while a real provider implementation is being wired in.

### Audit

The template includes a lightweight audit foundation centered on `AuditService.record(...)`. It persists actor and request metadata from the request context so important domain mutations can be recorded without coupling every module to transport details.

This is intentionally not event sourcing. It is a narrow audit log for traceability of meaningful business actions.

### Notification

The template includes a shared `NotificationService` plus an email notification channel. Email notifications can be delivered synchronously or queued through the existing job infrastructure by setting `delivery: 'async'`.

This is an application-level notification seam, not a full notification product. It does not include inbox models, preference management, push providers, or realtime delivery.

### SSE

The template includes a lightweight Server-Sent Events foundation for authenticated one-way realtime streams. The shared `SseService` manages per-user connections, targeted publishes, broadcast publishes, and heartbeat events.

The example transport endpoint is `GET /v1/events/stream`. It is JWT-protected and intended as a base for operational updates, notification fan-out, or job-progress streaming without committing the template to WebSockets.

### WebSocket

The template also includes a narrow WebSocket transport foundation built on Nest gateways and Socket.IO. The shared `WsGateway` authenticates connections with an access token from `handshake.auth.token` or an `Authorization: Bearer ...` header, then joins built-in `user:{userId}` and `session:{sessionId}` rooms.

The shared `WsService` exposes `emitToUser`, `emitToSession`, `emitToRoom`, and `broadcast` so domain modules can publish realtime events without owning socket-server lifecycle details.

### Storage

- `STORAGE_DRIVER`
- `STORAGE_LOCAL_ROOT`
- `STORAGE_PUBLIC_BASE_URL`
- `STORAGE_OBJECT_STORAGE_ENDPOINT`
- `STORAGE_OBJECT_STORAGE_REGION`
- `STORAGE_OBJECT_STORAGE_BUCKET`
- `STORAGE_OBJECT_STORAGE_ACCESS_KEY`
- `STORAGE_OBJECT_STORAGE_SECRET_KEY`
- `STORAGE_OBJECT_STORAGE_FORCE_PATH_STYLE`

Supported storage drivers:

- `local`
- `minio`

The storage module also includes a generic object-key builder for callers that want consistent key shapes across domains. The intended pattern is:

```text
{env}/{visibility}/{scope...}/{segments...}/{filename}.{extension}
```

Example:

```text
dev/public/users/{userId}/avatars/original/{fileId}.webp
```

`STORAGE_LOCAL_ROOT` is used only when `STORAGE_DRIVER=local`.

When `STORAGE_DRIVER=minio`, these variables are required:

- `STORAGE_OBJECT_STORAGE_ENDPOINT`
- `STORAGE_OBJECT_STORAGE_BUCKET`
- `STORAGE_OBJECT_STORAGE_ACCESS_KEY`
- `STORAGE_OBJECT_STORAGE_SECRET_KEY`

`STORAGE_OBJECT_STORAGE_REGION` defaults to `us-east-1`.
`STORAGE_OBJECT_STORAGE_FORCE_PATH_STYLE` defaults to `true`, which matches local MinIO setups.
`STORAGE_PUBLIC_BASE_URL` remains optional and, when set, is used to build returned object URLs for either driver.

Legacy `STORAGE_MINIO_*` variables are still accepted as fallbacks, but `STORAGE_OBJECT_STORAGE_*` is the preferred naming.

## Default Modules

### Auth

The auth module provides:

- register
- login
- refresh session
- logout
- current authenticated user
- JWT guard support
- permission guard support

It also includes RBAC persistence primitives:

- roles
- permissions
- user-role assignments
- role-permission assignments
- sessions
- password and email-verification token entities

### User

The user module is both a usable starter module and an example of how a domain can sit on top of auth and RBAC foundations. It includes REST and GraphQL entrypoints for common user flows.

### Health

The health module exposes a non-throttled health endpoint intended for probes and operational checks.

### Cache

The cache module registers Nest cache support globally using the configured driver.

### Rate Limiting

The rate-limit module applies a global throttling guard and uses Redis-backed storage outside tests by default.

### Queue

The queue module provides an application-facing `JobDispatcher` port, Redis-backed BullMQ dispatching in non-test environments, and inline execution in tests. The template currently routes welcome email delivery through this queue so external IO is no longer tied to the request path.

### Mail

The mail module hides delivery behind a `MailSender` abstraction so projects can start with logging and move to a real provider later.

### Storage

The storage module hides file handling behind a `StorageService` abstraction and currently ships with a local-disk adapter.

## Database and Seed Data

Migrations live in [database/migrations](/Volumes/Local/dev/pj-personal/templates/api/nest-template/api/database/migrations) and are executed through MikroORM.

Available commands:

```bash
pnpm run db:migration:create
pnpm run db:migration:up
pnpm run db:migration:down
pnpm run db:seed
pnpm run db:seed:demo
```

Seed data lives in [seed-data](/Volumes/Local/dev/pj-personal/templates/api/nest-template/seed-data) and is TSV-backed.

Reference seed data created by `pnpm run db:seed`:

- roles: `admin`, `member`
- permissions: `auth.me.read`, `auth.session.manage`, `users.read`, `users.manage`, `roles.read`, `roles.manage`

Demo users created by `pnpm run db:seed:demo`:

- `admin@example.com` / `password123`
- `member@example.com` / `password123`

Local-only demo users can be added with `seed-data/auth-users.local.tsv`. A starter schema is provided in `seed-data/auth-users.local.example.tsv`.

Those defaults are starter data, not a claim that every project should keep the same policy model unchanged.

## Default Endpoints

REST endpoints under the default prefix:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /health`

GraphQL endpoint:

- `POST /graphql`

## Testing

Run unit tests:

```bash
pnpm test
```

Run end-to-end tests:

```bash
pnpm test:e2e
```

The auth e2e suite creates and drops a temporary PostgreSQL database per run. Local PostgreSQL still needs to be available before running e2e.

## Notes for Reuse

This starter is best treated as a strong default shape for backend services, not as a promise that every included module is mandatory forever.

Good candidates to keep as a baseline:

- auth
- RBAC
- health
- cache
- rate limiting
- mail abstraction
- storage abstraction
- database setup

Good candidates to trim or replace per project:

- the example user module
- GraphQL if the service is REST-only
- specific seed roles, permissions, and default accounts
