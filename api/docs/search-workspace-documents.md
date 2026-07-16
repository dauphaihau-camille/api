# Search Workspace Documents

This document explains how workspace document search currently works in the API.

For the architectural decision behind this implementation, see [ADR-0001](./adr/0001-use-postgres-full-text-search-for-documents.md).

## Overview

Workspace document search is exposed through a dedicated search endpoint rather than being folded into the generic document listing endpoints.

The current design supports:

- ranked search across document title and extracted document body text
- empty-query fallback to recent document visits for the current user
- workspace-scoped results only
- exclusion of archived documents from active search results

## API Surface

Active document search is handled by:

- `GET /workspaces/:workspaceId/search/documents`

The endpoint accepts:

- `q`: optional query string
- `limit`: optional result limit

The response includes:

- document identity fields
- title
- breadcrumb path
- `matched_text` when a snippet can be built
- `visited_at` when the result came from the recent-visit fallback

Reference:

- [`api/src/modules/domains/search/api/rest/search.controller.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/search/api/rest/search.controller.ts:34)
- [`api/src/modules/domains/search/api/rest/dto/search-document-response.dto.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/search/api/rest/dto/search-document-response.dto.ts:4)

## Query Behavior

The search use case first resolves the workspace for the authenticated user. After that it branches on whether `q` is present.

### When `q` Is Empty

If `q` is missing or trims to an empty string:

- the endpoint does not run full-text search
- it returns the user’s recent visited documents in that workspace
- results are ordered by `lastVisitedAt` descending
- archived documents are excluded

Reference:

- [`api/src/modules/domains/search/app/use-cases/search-workspace-documents.use-case.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/search/app/use-cases/search-workspace-documents.use-case.ts:17)
- [`api/src/modules/domains/search/infra/mikro-orm-search.repository.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/search/infra/mikro-orm-search.repository.ts:15)

### When `q` Is Present

If `q` has meaningful content:

- the query is normalized and converted into a PostgreSQL prefix `tsquery`
- full-text search runs against `documents.search_vector`
- only non-archived documents in the requested workspace are considered
- results are ranked and returned as document summaries

Reference:

- [`api/src/modules/domains/search/app/use-cases/search-workspace-documents.use-case.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/search/app/use-cases/search-workspace-documents.use-case.ts:40)
- [`api/src/modules/domains/search/infra/mikro-orm-search.repository.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/search/infra/mikro-orm-search.repository.ts:40)

## Query Normalization

The repository converts the raw query string into a prefix `tsquery` string.

Current normalization rules:

- trim whitespace
- lowercase the input
- split on whitespace
- replace `'` and `:` before token cleanup
- remove characters outside `[a-z0-9_-]`
- drop empty tokens
- join remaining tokens with ` & `
- apply `:*` to each token for prefix matching

Example:

```text
"Hello world" -> "hello:* & world:*"
```

This means the current search behaves like an AND query across normalized tokens, with prefix matching on each token.

Reference:

- [`api/src/modules/domains/search/infra/mikro-orm-search.repository.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/search/infra/mikro-orm-search.repository.ts:178)

## Indexing Pipeline

Search depends on two document columns:

- `search_text`
- `search_vector`

### `search_text`

`search_text` is a flattened text representation of the editor JSON stored in `content_json`.

At the application layer, text extraction walks:

- `text`
- `content`
- `children`

and then normalizes whitespace.

Reference:

- [`api/src/modules/domains/document/app/utils/document-search-text.util.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/app/utils/document-search-text.util.ts:1)

### `search_vector`

`search_vector` is a generated PostgreSQL `tsvector` built from:

- title with weight `A`
- `search_text` with weight `B`

This gives title matches higher priority than body-only matches.

Reference:

- [`api/database/migrations/Migration20260702000100.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/database/migrations/Migration20260702000100.ts:33)

### Database Migration Support

The initial migration:

- adds `search_text`
- backfills it from `content_json`
- adds generated `search_vector`
- creates a partial GIN index on non-archived documents

A follow-up migration updates the SQL extraction function so nested editor nodes under `content` and `children` are handled more reliably.

Reference:

- [`api/database/migrations/Migration20260702000100.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/database/migrations/Migration20260702000100.ts:4)
- [`api/database/migrations/Migration20260702000200.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/database/migrations/Migration20260702000200.ts:4)

### Write-Time Synchronization

`search_text` is recomputed when documents are created or when content changes on update.

This keeps the stored search data aligned with document edits before PostgreSQL recomputes the generated `search_vector`.

Reference:

- [`api/src/modules/domains/document/app/use-cases/create-document.use-case.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/app/use-cases/create-document.use-case.ts:75)
- [`api/src/modules/domains/document/app/use-cases/update-document.use-case.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/app/use-cases/update-document.use-case.ts:65)

## Ranking And Result Shape

Matched documents are ordered by:

1. whether the title itself matches the query
2. `ts_rank_cd(search_vector, to_tsquery(...))`
3. `updated_at` descending

After raw IDs are selected, the repository loads full document entities and maps them into search summaries with:

- teamspace breadcrumb when present
- ancestor titles
- updated-by display name fallback to email
- content presence flag

Reference:

- [`api/src/modules/domains/search/infra/mikro-orm-search.repository.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/search/infra/mikro-orm-search.repository.ts:52)
- [`api/src/modules/domains/search/app/use-cases/search-workspace-documents.use-case.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/search/app/use-cases/search-workspace-documents.use-case.ts:49)

## Snippet Behavior

`matched_text` is not generated by PostgreSQL highlighting.

Instead, the repository:

- lowercases `search_text`
- searches for the raw normalized query as a direct substring
- clips around the first match to approximately 160 characters

Because full-text matching and snippet extraction use different logic, a document can match the full-text query but still have no `matched_text` value.

Examples:

- tokenized prefix matches may succeed without finding the exact raw query substring
- title-only matches may rank highly even if body text has no snippet-worthy match

Reference:

- [`api/src/modules/domains/search/infra/mikro-orm-search.repository.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/search/infra/mikro-orm-search.repository.ts:149)

## Recent Visit Fallback

Recent visits depend on `document_visits`.

When a user opens a document through the document read flow, the application records or updates a visit row with the current `lastVisitedAt`. The search endpoint reuses that data when `q` is empty.

Reference:

- [`api/src/modules/domains/document/infra/mikro-orm-document-visit.repository.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/infra/mikro-orm-document-visit.repository.ts:23)
- [`api/src/modules/domains/document/app/use-cases/get-document.use-case.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/app/use-cases/get-document.use-case.ts:31)

## Difference From Document List Search

This is important: document listing and document search are not the same feature.

`GET /workspaces/:workspaceId/search/documents`

- searches title and body text
- uses PostgreSQL full-text search
- returns ranked results
- falls back to recent visits when `q` is empty

`GET /workspaces/:workspaceId/documents?q=...`

- uses title-only substring matching with `ILIKE`
- is part of navigation/listing behavior
- does not rank like the search endpoint
- does not search extracted body text

Reference:

- [`api/src/modules/domains/document/infra/mikro-orm-document-navigation-query.repository.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/infra/mikro-orm-document-navigation-query.repository.ts:39)

## Known Limitations

- Search token normalization is currently simple and ASCII-oriented.
- Query tokens are combined with AND semantics only.
- There is no typo tolerance, synonym expansion, or language-aware stemming.
- `matched_text` can be missing even when a result legitimately matched.
- The listing endpoints and search endpoint use different matching strategies, which is intentional but may surprise future contributors if undocumented.
