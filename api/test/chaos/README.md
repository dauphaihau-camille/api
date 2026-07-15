# Chaos Tests

This directory contains black-box dependency chaos checks for the running local stack.

## Scope

- Stop or restart infrastructure dependencies in the compose stack.
- Assert readiness behavior for dependencies that are part of health checks.
- Assert user-facing requests fail fast or continue succeeding, depending on the dependency.

## Run

From the API package root:

```bash
pnpm start:dev
# in another shell
pnpm test:chaos
```

The runner reads `STORAGE_DRIVER` from `api/.env` by default. When `STORAGE_DRIVER=local`, the MinIO outage case is skipped because object storage is not part of the active request path or readiness check for that environment.

## Current coverage

- `postgres`: readiness degrades and registration fails quickly.
- `minio`: readiness degrades when `STORAGE_DRIVER=minio`, while registration still succeeds because the register flow does not touch object storage.
- `redis`: readiness stays green and registration still succeeds via in-memory or fail-open fallbacks for cache, throttling, idempotency, and async side effects.
- `otel-collector`: readiness stays green and registration still succeeds.
- `worker`: readiness stays green and registration still succeeds because enqueueing should not depend on a running worker process.
- `worker` is skipped when `api/.env.docker` is missing, because the compose `worker` service cannot be managed without that env file.
