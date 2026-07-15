# API Project Structure

This document describes the filesystem structure used by the API app and the layering conventions that help the project scale as new modules are added.

The current reference implementation lives in [apps/api](/Volumes/Local/dev/pj-personal/apps/arc/codebase/apps/api), with the Nest application source under [apps/api/api](/Volumes/Local/dev/pj-personal/apps/arc/codebase/apps/api/api).

## Workspace Layout

```text
apps/api/
├── agent-skills/   # agent guidance and repository conventions
├── api/            # Nest application source
├── cloudflare/     # edge or scheduled workers when needed
├── docs/           # project and architecture documentation
├── infra/          # local observability and infrastructure configs
├── scripts/        # operational scripts outside the Nest runtime
├── seed-data/      # shared seed fixtures and assets
├── README.md
└── justfile
```

## Nest App Top-Level Layout

```text
api/
├── api-tests/      # Hurl or black-box HTTP checks
├── database/       # migrations and seed scripts
├── dist/           # build output
├── logs/           # local runtime logs
├── scripts/        # operational and maintenance scripts
├── src/            # application source
├── test/           # e2e, integration, and performance tests
├── package.json
└── tsconfig*.json
```

## Important Top-Level Directories

### `src/`

Main application source.

- [src/index.ts](/Volumes/Local/dev/pj-personal/apps/arc/codebase/apps/api/api/src/index.ts): HTTP API bootstrap
- [src/worker.ts](/Volumes/Local/dev/pj-personal/apps/arc/codebase/apps/api/api/src/worker.ts): background worker bootstrap
- [src/modules/app.module.ts](/Volumes/Local/dev/pj-personal/apps/arc/codebase/apps/api/api/src/modules/app.module.ts): root Nest module

### `database/`

Database lifecycle assets.

- `database/migrations/`: MikroORM migrations
- `database/seeds/`: seed flows, loaders, and seed helpers

### `scripts/`

Nest-runtime scripts for backfills, cleanup jobs, admin tasks, or local maintenance.

### `test/`

Test suites and supporting runtime helpers.

Typical split:
- `test/e2e/`: full HTTP or app-runtime flows
- `test/integration/`: module or persistence integration checks
- `test/performance/`: load or benchmark scenarios

### `docs/`

Project documentation for architecture decisions, local workflows, operating guides, and feature notes.

## `src/` Structure

```text
src/
├── common/
├── config/
├── libs/
└── modules/
```

### `common/`

Cross-cutting application utilities and framework glue.

Examples:
- `application/`
- `database/`
- `decorators/`
- `docs/`
- `errors/`
- `events/`
- `filters/`
- `ids/`
- `interceptors/`
- `jobs/`
- `listeners/`
- `logging/`
- `pipes/`
- `sentry/`
- `utils/`

Keep `common/` for code that is truly cross-cutting. If logic belongs to one business capability, keep it in that module instead.

### `config/`

Configuration builders and environment parsing.

Examples include:
- app runtime config
- database config
- cache and queue config
- auth config
- external service config
- storage or CORS config

### `libs/`

Local utility libraries shared inside the API app when they do not fit a specific module or cross-cutting framework area.

### `modules/`

The main organizational unit of the codebase.

- `modules/domains/`: business capabilities
- `modules/shared/`: technical or platform capabilities reused across domains
- `modules/app.module.ts`: composition root for the app runtime

## Module Split

### `modules/domains/`

Business modules capture use cases and rules for the product you are building.

The current reference app includes modules such as:

- `auth/`
- `cart/`
- `category/`
- `chat/`
- `checkout/`
- `coupon/`
- `order/`
- `product/`
- `shop/`
- `user/`

Treat these as examples, not a required list for the template. A different project may have completely different domain names.

Each domain module owns its use cases, transport layer, persistence adapters, and domain-specific rules.

### `modules/shared/`

Technical capabilities reused by multiple domains.

The current reference app includes modules such as:

- `ai/`
- `audit/`
- `cache/`
- `currency/`
- `health/`
- `idempotency/`
- `image-transform/`
- `mail/`
- `marketplace/`
- `notification/`
- `observability/`
- `payment/`
- `queue/`
- `rate-limit/`
- `request-context/`
- `sse/`
- `storage/`
- `ws/`

These are infrastructure or platform support modules, not business domains.

## Domain Module Internal Pattern

Domain modules generally follow a layered structure influenced by Clean Architecture and DDD.

Using [src/modules/domains/product](/Volumes/Local/dev/pj-personal/apps/arc/codebase/apps/api/api/src/modules/domains/product) as a reference example:

```text
domain-module/
├── api/        # controllers, DTOs, presenters, response models
├── app/        # use cases, ports, services, app errors, app events
├── domain/     # domain types and rules
├── infra/      # persistence and external adapters
├── listeners/  # event listeners wired to the module
└── *.module.ts
```

This is a scaling pattern, not a requirement that every module has identical depth.

### `api/`

Transport-facing code only.

The main organizing axis is usually feature or endpoint boundary first, role second.

Preferred rule:
- first group by feature, endpoint surface, or consumer boundary
- then group by role such as `dto`, `presenters`, or `responses` inside that feature folder

Example:

```text
api/rest/
├── public/
├── internal/
├── admin/
└── webhooks/
```

Avoid flattening all DTOs, presenters, and responses for the whole module into one shared `api/rest` folder unless the module is extremely small.

### `app/`

Application-layer orchestration.

Typical contents:
- `use-cases/`: one folder per use case
- `ports/`: abstract contracts for repositories and external collaborators
- `services/`: workflow and coordination logic
- `errors/`: application errors
- `events/`: application event contracts
- `config/`: module-local app configuration

### `domain/`

Domain-level types and rules that should stay independent from transport details and infrastructure concerns.

### `infra/`

Concrete implementations of ports and infrastructure details.

Preferred rule:
- first group by infrastructure boundary or backing technology
- then group by role inside that boundary, such as `entities`, `repositories`, `documents`, `reads`, or `clients`

Example:

```text
infra/
├── persistence/
│   └── mikro-orm/
│       ├── entities/
│       ├── reads/
│       └── repositories/
├── search/
│   └── elasticsearch/
│       └── repositories/
└── projection/
```

This keeps persistence, search, projections, and external store adapters separated by concern instead of mixing all repositories or all entities at the same level.

### `listeners/`

Consumers of internal application events that trigger follow-up work such as cache invalidation, notifications, projections, or asynchronous workflows.

## File Organization Conventions

### Use cases

Use cases usually live in their own folder:

```text
app/use-cases/create-resource/
├── create-resource.use-case.ts
└── create-resource.use-case.spec.ts
```

This keeps behavior and tests close together.

### Ports and adapters

Ports live under `app/ports/`, while concrete implementations live under `infra/...`.

Example pattern:

```text
app/ports/public-resource-query.repository.ts
infra/persistence/mikro-orm/repositories/mikro-orm-public-resource-query.repository.ts
```
