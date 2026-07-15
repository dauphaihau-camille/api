# Test Guide

This directory contains the API test suites and supporting assets.

## Test Commands

```bash
pnpm test
pnpm test:e2e
pnpm test:int
pnpm test:hurl
pnpm test:chaos
pnpm test:perf
```

## Layout

- `e2e/`: end-to-end suites
- `integration/`: integration suites
- `support/`: shared test helpers
- `performance/`: k6 performance scenarios and runners
- `chaos/`: dependency failure checks
- `jest-e2e.json`: e2e Jest config

## E2E Notes

`pnpm test:e2e` disables Watchman explicitly so Jest can run in restricted or sandboxed environments where the Watchman socket is not accessible.

The e2e bootstrap loads `api/.env` before each suite file runs, then creates a real temporary PostgreSQL database per suite. Make sure local Postgres is reachable before running e2e, typically through the workspace Docker stack on `127.0.0.1:55433`, or override `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` in the shell to point at another local instance.

## Performance Tests

The performance runner uses `pnpm test:perf` and selects the k6 script through `K6_SCRIPT`.

Login flow example:

```bash
BASE_URL=http://127.0.0.1:3000/v1 \
LOGIN_EMAIL=member@example.com \
LOGIN_PASSWORD=password123 \
pnpm test:perf
```

Optional environment variables:

- `K6_SCRIPT=login.load.js`
- `SCENARIO=normal-traffic.json`
- `K6_VUS=5`
- `K6_DURATION=30s`

The default script is `login.load.js`, and the default scenario file is [scenarios/normal-traffic.json](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/test/performance/scenarios/normal-traffic.json).

Document traffic example:

```bash
BASE_URL=http://127.0.0.1:3000/v1 \
LOGIN_EMAIL=member@example.com \
LOGIN_PASSWORD=password123 \
K6_SCRIPT=documents.load.js \
pnpm test:perf
```

The default document profile is [performance/scenarios/document-traffic.json](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/test/performance/scenarios/document-traffic.json).

First soak run example:

```bash
RATE_LIMIT_LIMIT=100000 pnpm start:dev
# in another shell
BASE_URL=http://127.0.0.1:3000/v1 \
LOGIN_EMAIL=member@example.com \
LOGIN_PASSWORD=password123 \
K6_SCRIPT=documents.load.js \
SCENARIO=documents-soak.json \
pnpm test:perf
```

The soak profile is [performance/scenarios/documents-soak.json](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/test/performance/scenarios/documents-soak.json) and defaults to a 1-hour steady-state run. If you run it locally, keep the machine awake for the full duration. `K6_DURATION` can override the scenario duration when you need a shorter or longer pass.

## Chaos Tests

Chaos test details live in [chaos/README.md](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/test/chaos/README.md).
