# Observability Queries

Canonical Grafana Loki queries for the local observability stack.

Use these in Grafana Explore with the `Loki` datasource selected.

Replace `your-api-service` with the actual `service` label emitted by your application.

## API logs

All API logs:

```logql
{service="your-api-service", runtime="api"}
```

API errors only:

```logql
{service="your-api-service", runtime="api", level="error"}
```

HTTP request exceptions:

```logql
{service="your-api-service", event="http.request.exception"}
```

Failed HTTP requests:

```logql
{service="your-api-service", event="http.request.failed"}
```

Completed HTTP requests:

```logql
{service="your-api-service", event="http.request.completed"}
```

## Worker logs

All worker logs:

```logql
{service="your-api-service", runtime="worker"}
```

Worker errors only:

```logql
{service="your-api-service", runtime="worker", level="error"}
```

Queue job failures:

```logql
{service="your-api-service", runtime="worker"} |= "queue.job.failed"
```

Queue job starts:

```logql
{service="your-api-service", runtime="worker"} |= "queue.job.started"
```

## Investigation patterns

Search by request ID:

```logql
{service="your-api-service"} |= "req-123"
```

Search by route:

```logql
{service="your-api-service"} |= "/v1/resources"
```

Search for one business flow or module:

```logql
{service="your-api-service"} |= "checkout"
```

Search for one actor:

```logql
{service="your-api-service"} |= "\"actorId\":\"user-123\""
```

Search for one trace ID:

```logql
{service="your-api-service"} |= "\"traceId\":\"abc123\""
```

## Usage notes

- Start with a short time range such as `Last 15 minutes` or `Last 1 hour`.
- Filter by `service` and `runtime` first, then narrow by `level` or `event`.
- Keep event names stable and structured so logs, metrics, and traces can be correlated consistently.
- Use metrics to detect spikes, traces to find latency, and logs to inspect exact request or job context.
