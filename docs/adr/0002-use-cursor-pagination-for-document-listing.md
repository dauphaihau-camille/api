# ADR-0002: Use Cursor Pagination For Document Listing

## Status

Accepted

## Date

2026-07-09

## Context

The API exposes document listing endpoints that operate over mutable ordered collections:

- active workspace document navigation
- archived workspace document listing

These collections can change while a user is paging:

- new documents can be inserted
- documents can be reordered through `sortKey`
- documents can be archived or restored

The codebase already distinguishes between:

- user listing, which currently uses page and limit metadata
- document listing, which behaves more like navigation over ordered records

For document listing, the API needs pagination that:

- preserves stable forward traversal across ordered results
- handles ties deterministically
- avoids offset drift when records are inserted or reordered
- stays simple enough for the current repository and use-case structure

## Options Considered

### Option A: Offset pagination with page and limit

- Pros:
  - familiar to many clients
  - easy to document
  - supports direct page-number navigation
- Cons:
  - unstable for mutable ordered document lists
  - inserts and reorders can cause duplicates or skipped records between pages
  - becomes harder to reason about when document order is driven by `sortKey`

### Option B: Cursor pagination based on stable sort keys

- Pros:
  - stable forward traversal when ordering changes less than offsets shift
  - aligns naturally with document navigation ordered by `sortKey`
  - deterministic when combined with a secondary tie-breaker
  - simpler client contract for infinite-scroll style navigation
- Cons:
  - no direct page-number navigation
  - requires opaque cursor handling on clients
  - current implementation still performs filtering and slicing in application memory

### Option C: Database-level cursor pagination pushed fully into SQL

- Pros:
  - preserves cursor semantics while scaling better than in-memory slicing
  - avoids loading the full ordered result set before pagination
  - can reduce memory and query cost for larger datasets
- Cons:
  - more complex repository queries
  - more query branching for active versus archived ordering
  - more implementation effort than the current project needs immediately

## Decision

We use cursor pagination for document listing endpoints.

The cursor is built from the same fields that define the stable ordering for each list:

- active documents use `sortKey ASC, id ASC`
- archived documents use `archivedAt DESC, id DESC`

The API exposes only forward pagination through `next_cursor`. Clients continue by supplying the returned cursor unchanged.

We accept the current implementation shape where:

- repositories load matching ordered documents
- use cases decode the cursor
- use cases apply the cursor predicate in memory
- use cases slice `limit + 1` to determine whether another page exists

This keeps the pagination logic explicit in the application layer while the dataset and complexity remain manageable.

## Consequences

- Document listing is more stable under inserts and reordering than offset pagination would be.
- Clients must treat cursors as opaque and cannot rely on page numbers.
- The active and archived listing flows each need their own cursor payload and comparison logic.
- Root document navigation remains grouped by private documents and teamspace documents rather than being one flat globally paginated stream.
- This pagination model fits scroll-driven or incremental loading UIs, such as the web app's root-document `More` popover.
- The current implementation may need to move cursor predicates into SQL if document counts or query costs grow materially.
- The project now intentionally uses different pagination strategies for different domains:
  - page and limit for simpler user listing
  - cursor pagination for mutable ordered document navigation

## Related Code

- [`api/src/modules/domains/document/api/rest/document.controller.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/api/rest/document.controller.ts:104)
- [`api/src/modules/domains/document/api/rest/dto/list-workspace-documents-query.dto.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/api/rest/dto/list-workspace-documents-query.dto.ts:14)
- [`api/src/modules/domains/document/app/use-cases/list-workspace-documents.use-case.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/app/use-cases/list-workspace-documents.use-case.ts:26)
- [`api/src/modules/domains/document/app/use-cases/list-archived-workspace-documents.use-case.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/app/use-cases/list-archived-workspace-documents.use-case.ts:22)
- [`api/src/modules/domains/document/infra/mikro-orm-document-navigation-query.repository.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/infra/mikro-orm-document-navigation-query.repository.ts:39)
- [`api/src/common/application/pagination.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/common/application/pagination.ts:1)
