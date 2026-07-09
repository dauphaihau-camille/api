# ADR-0001: Use PostgreSQL Full-Text Search For Workspace Document Search

## Status

Accepted

## Date

2026-07-09

## Context

The API needs a workspace document search experience that can:

- search both document titles and document body text
- return ranked results fast enough for interactive use
- stay consistent with document writes without introducing a separate indexing service
- fit the current modular monolith and PostgreSQL-first operational model

Documents are stored in PostgreSQL. Body content is persisted as structured JSON in `content_json`, so searching requires a flattened representation in addition to the raw editor structure.

At the same time, the project already distinguishes between:

- document navigation queries, which often need simple title filtering
- a dedicated search flow, which needs ranking and broader text matching

## Options Considered

### Option A: PostgreSQL full-text search with generated vectors

- Pros:
  - stays inside the existing primary datastore
  - transactional consistency between writes and search data
  - no extra service to operate in development or production
  - supports weighted ranking across title and body text
  - works well for the current scale and architecture
- Cons:
  - less flexible than a dedicated search engine for advanced relevance tuning
  - requires explicit text extraction from JSON content
  - snippet generation and highlighting remain application concerns

### Option B: Title-only `ILIKE` matching

- Pros:
  - simple to implement and easy to understand
  - no extra indexing model beyond normal relational data
- Cons:
  - does not search document body text
  - weak relevance ordering
  - performs poorly as the dataset grows
  - does not support a real search experience

### Option C: External search engine such as Elasticsearch or Meilisearch

- Pros:
  - richer relevance controls, typo tolerance, and highlighting
  - can scale into more advanced search product features
- Cons:
  - adds infrastructure, synchronization, and failure modes
  - increases local setup and operational complexity
  - premature for the current product and repository shape

## Decision

We use PostgreSQL full-text search for the dedicated workspace document search endpoint.

The implementation keeps two representations on `documents`:

- `search_text`, which stores flattened text extracted from editor JSON
- `search_vector`, which stores a generated weighted `tsvector`

Title text is weighted more heavily than body text so title matches rank first when relevant. Search runs through a dedicated `search` domain endpoint instead of being folded into the generic document navigation queries.

This keeps the search behavior explicit:

- `GET /workspaces/:workspaceId/search/documents` is the real search surface
- document listing endpoints may still use simpler title filtering where ranking is unnecessary

## Consequences

- We accept PostgreSQL-specific search behavior and query syntax in this implementation.
- We must keep `search_text` synchronized whenever document content changes.
- We must maintain JSON text extraction logic both in migrations and in application write paths.
- We gain ranked full-text search without introducing another service.
- If future requirements need typo tolerance, synonyms, language-aware stemming, or cross-entity search, this decision may need to be revisited with a new ADR.

## Related Code

- [`api/src/modules/domains/search/api/rest/search.controller.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/search/api/rest/search.controller.ts:34)
- [`api/src/modules/domains/search/app/use-cases/search-workspace-documents.use-case.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/search/app/use-cases/search-workspace-documents.use-case.ts:17)
- [`api/src/modules/domains/search/infra/mikro-orm-search.repository.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/search/infra/mikro-orm-search.repository.ts:40)
- [`api/src/modules/domains/document/app/utils/document-search-text.util.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/app/utils/document-search-text.util.ts:1)
- [`api/database/migrations/Migration20260702000100.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/database/migrations/Migration20260702000100.ts:23)
- [`api/database/migrations/Migration20260702000200.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/database/migrations/Migration20260702000200.ts:4)
