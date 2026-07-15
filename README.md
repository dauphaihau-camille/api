# Camille API Workspace

Backend API workspace for the Camille app, built around NestJS, MikroORM, PostgreSQL, Redis, MinIO, and a local observability stack.

## Overview

This repository contains the NestJS application, local infrastructure, supporting docs, and seed assets needed to run the API in development.

The codebase follows a modular monolith structure with clear domain and shared-module boundaries. It leans on Clean Architecture style layering inside modules, with explicit use cases, ports, adapters, domain errors, and event-driven side effects where that separation pays off.

Top-level structure:

- `api/` - NestJS application source, config, migrations, scripts, and tests
- `agents/` - repository guidance and agent-facing notes
- `docs/` - architecture and local-runtime documentation
- `infra/` - Docker Compose services for app dependencies and observability
- `scripts/` - workspace-level helper scripts
- `seed-data/` - seed assets and reference data

## Implemented Patterns and Capabilities

### Architecture

- **Modular monolith** - the backend is delivered as one NestJS app while keeping business capabilities isolated in `domains/` and technical capabilities in `shared/`
- **Layered module structure** - modules are split into `api`, `app`, `domain`, and `infra` so transport, orchestration, business rules, and persistence stay separate
- **Use cases plus ports/adapters** - application behavior is expressed as explicit use cases with infrastructure hidden behind repositories and service interfaces
- **Request context propagation** - CLS-backed request context carries actor and request metadata through request handling and async work
- **Layered error model** - domain and application errors are kept separate from HTTP concerns and mapped at the transport edge. See [`docs/layered-error-model.md`](docs/layered-error-model.md)
- **Event-driven side effects** - shared events and listeners decouple follow-up actions such as cache invalidation and welcome-email delivery from the initiating use case

### Product and API Surface

- **Cursor pagination** - document listing uses forward-only `next_cursor` pagination instead of page numbers. See [`docs/cursor-pagination.md`](docs/cursor-pagination.md)
- **Full-text search** - workspace document search uses PostgreSQL full-text search across titles and body text. See [`docs/search-workspace-documents.md`](docs/search-workspace-documents.md)
- **JWT and cookie-backed auth flows** - authentication supports access and refresh token flows with HTTP-only cookie support
- **RBAC foundations** - roles and permission checks are built into the auth and user-management path
- **REST-first API** - the main HTTP surface is versioned under `/v1`
- **OpenAPI and Scalar docs** - generated API docs are exposed at `/docs` with raw OpenAPI JSON at `/docs/openapi.json`
- **DTO validation and config schema validation** - request payloads use Nest validation and environment config is validated with Zod at boot
- **Idempotency support on selected writes** - the shared idempotency interceptor can safely deduplicate repeated client requests
- **SSE and WebSocket foundations** - the workspace includes transport seams for server-sent events and authenticated Socket.IO-based realtime flows
- **OAuth sign-in (Google and GitHub)** - the API supports external identity-provider login flows with callback handling and linked OAuth accounts

### Shared Platform Capabilities

- **Structured persistence** - MikroORM manages PostgreSQL access, migrations, and repeatable seed flows
- **Redis-backed cache and throttling** - cache and rate limiting default to Redis outside tests, with lighter in-memory fallbacks for test scenarios
- **Dedicated worker process** - background jobs run through a separate worker entrypoint backed by BullMQ
- **Audit logging foundation** - important domain actions can record actor and request metadata without coupling business code to transport details
- **Mail, notification, payment, storage, and AI abstractions** - shared provider seams let product modules depend on stable contracts instead of vendor-specific SDKs
- **Signed or structured file handling path** - the storage layer supports local or S3-compatible object storage with consistent key-shaping conventions

### Operations

- **Structured logging with correlation context** - request and worker logs are emitted through `nestjs-pino` with request-aware metadata
- **Prometheus metrics** - the API exposes `/metrics` for local monitoring and dashboards
- **OpenTelemetry tracing** - API and worker processes are wired for OTEL export through the local collector
- **Local logs, metrics, and traces stack** - Grafana, Loki, Tempo, Prometheus, Promtail, and the OTEL collector are provisioned in Docker Compose
- **Health and readiness endpoints** - `/health` and `/health/ready` support probes and local verification
- **Two supported local runtime modes** - use host-run app plus Compose infra for fast iteration, or full Compose stack for container parity. See [`docs/local-dev-runtime-modes.md`](docs/local-dev-runtime-modes.md)

## Stack

- NestJS 11
- MikroORM
- PostgreSQL
- Redis
- BullMQ
- MinIO / S3-compatible object storage
- Zod
- OpenTelemetry
- Prometheus, Loki, Tempo, and Grafana
- PNPM
- Docker Compose
- Just

## Requirements

- Node.js `22.x`
- PNPM `9.x`
- Docker
- Docker Compose
- `just`

## Getting Started

### 1. Start local infrastructure

```bash
just infra-up
```

This starts:

- PostgreSQL on `localhost:55433`
- Redis on `localhost:56380`
- MinIO API on `localhost:19002`
- MinIO Console on `localhost:19003`
- OpenTelemetry Collector on `localhost:14327` and `localhost:14328`
- Prometheus on `http://localhost:29090`
- Loki on `http://localhost:23100`
- Tempo on `http://localhost:23200`
- Grafana on `http://localhost:23001` (`admin` / `admin`)

### 2. Install dependencies

```bash
just api-install
```

### 3. Configure environment

```bash
cp api/.env.example api/.env
```

### 4. Run the default local dev path

For the fastest edit and debug loop with observability still enabled:

```bash
just api-up-observability
just api-worker-up-observability
```

This keeps the API and worker on the host in watch mode while Docker runs Postgres, Redis, MinIO, and the observability services.

### 5. Run the full containerized stack instead

```bash
just stack-up
```

Use this when you want container-runtime parity instead of the faster host-run development loop.

After startup, the main endpoints are:

- API docs: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs/openapi.json`
- Metrics: `http://localhost:3000/metrics` with `Authorization: Bearer local-dev-metrics-token`
- Bull Board: `http://localhost:3000/ops/queues`
- Health: `http://localhost:3000/health`
- Readiness: `http://localhost:3000/health/ready`

Prometheus is preconfigured to scrape `/metrics` with the same local development bearer token from `api/.env.example` and `api/.env.docker.example`.

## Useful Commands

```bash
just db-migration-up
just db-seed
just db-seed-demo
just db-seed-realistic
just api-up
just api-worker-up
cd api && pnpm test
cd api && pnpm test:e2e
cd api && pnpm test:int
cd api && pnpm test:hurl
```

## Additional Docs

- [`api/README.md`](api/README.md)
- [`docs/adr/README.md`](docs/adr/README.md)
- [`docs/api-project-structure.md`](docs/api-project-structure.md)
- [`docs/layered-error-model.md`](docs/layered-error-model.md)
- [`docs/local-dev-runtime-modes.md`](docs/local-dev-runtime-modes.md)
- [`docs/observability-queries.md`](docs/observability-queries.md)
- [`docs/search-workspace-documents.md`](docs/search-workspace-documents.md)
- [`docs/use-case-vs-service.md`](docs/use-case-vs-service.md)
- [`seed-data/README.md`](seed-data/README.md)
