# Observability Queries

Canonical Grafana Loki queries for the local observability stack.

Use these in Grafana Explore with the `Loki` datasource selected.

This repo emits `service="camille-api"` for local API logs.

Local host-process logs from `just api-up-observability` and `just api-worker-up-observability` are scraped with `source="host"`. Docker container logs are scraped with `source="docker"`.

Most app logs are JSON. Add `| json` before filtering parsed fields such as `event`, `http_route`, `requestId`, `traceId`, or `errorMessage`.

## API logs

All API logs:

```logql
{service="camille-api", source="host", runtime="api"} | json
```

API errors only:

```logql
{service="camille-api", source="host", runtime="api"} | json | level="error"
```

HTTP request exceptions:

```logql
{service="camille-api", source="host"} | json | context="GlobalExceptionFilter"
```

Failed HTTP requests:

```logql
{service="camille-api", source="host"} | json | event="http.request.failed"
```

Completed HTTP requests:

```logql
{service="camille-api", source="host"} | json | event="http.request.completed"
```

## Worker logs

All worker logs:

```logql
{service="camille-api", source="host", runtime="worker"} | json
```

Worker errors only:

```logql
{service="camille-api", source="host", runtime="worker"} | json | level="error"
```

Queue job failures:

```logql
{service="camille-api", source="host", runtime="worker"} | json | event="queue.job.failed"
```

Queue job starts:

```logql
{service="camille-api", source="host", runtime="worker"} | json | event="queue.job.started"
```

## Investigation patterns

Search by request ID:

```logql
{service="camille-api", source="host"} | json | requestId="req-123"
```

Search by route:

```logql
{service="camille-api", source="host"} | json | http_route="/v1/resources"
```

Search for one business flow or module:

```logql
{service="camille-api", source="host"} | json | context="CheckoutService"
```

Search for one actor:

```logql
{service="camille-api", source="host"} | json | actorId="user-123"
```

Search for one trace ID:

```logql
{service="camille-api", source="host"} | json | traceId="abc123"
```


Show an exception message:

```logql
{service="camille-api", source="host"} | json | context="GlobalExceptionFilter" | line_format "{{.errorMessage}}"
```

Correlate request failure and exception details:

```logql
{service="camille-api", source="host"} | json | requestId="req-123"
```

Route and exception fields are emitted on different log records. `RequestLoggingInterceptor` records `http_route` and `event="http.request.failed"`. `GlobalExceptionFilter` records `errorMessage` and `errorName`. Use `requestId` or `traceId` to inspect both rows for the same request.

## Usage notes

- Start with a short time range such as `Last 15 minutes` or `Last 1 hour`.
- Filter by `service` and `runtime` first, then narrow by `level` or `event`.
- Keep event names stable and structured so logs, metrics, and traces can be correlated consistently.
- Use metrics to detect spikes, traces to find latency, and logs to inspect exact request or job context.

If host-process logs from `just api-up-observability` do not appear with `source="host"`, check Colima bind mounts for the current worktree; see `docs/operations/local-dev-runtime-modes.md`.
