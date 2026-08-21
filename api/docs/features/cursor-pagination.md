# Cursor Pagination

This document explains how cursor pagination currently works in the API.

For the architectural decision behind this implementation, see [ADR-0002](./adr/0002-use-cursor-pagination-for-document-listing.md).

## Overview

This codebase currently uses two pagination styles:

- page and limit pagination in the `user` module
- cursor pagination for document listing endpoints

Cursor pagination is currently used for:

- `GET /workspaces/:workspaceId/documents`
- `GET /workspaces/:workspaceId/documents/archived`

The document endpoints use forward-only pagination. Clients request the first page without a cursor, then continue by sending the `next_cursor` from the previous response.

## API Surface

The shared query DTO for document listing is:

- [`api/src/modules/domains/document/api/rest/dto/list-workspace-documents-query.dto.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/api/rest/dto/list-workspace-documents-query.dto.ts:14)

Supported query parameters:

- `limit`: optional, defaults to `50`
- `cursor`: optional opaque string
- `q`: optional title filter
- `parent_document_id`: optional, only for active document navigation

Limit constraints are defined in:

- [`api/src/modules/domains/document/app/constants/document.constants.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/app/constants/document.constants.ts:6)

Current values:

- default limit: `50`
- maximum limit: `100`

## Response Shape

Paged document responses expose:

- `items`
- `next_cursor`

There is no `previous_cursor`, `has_next_page`, or total count.

References:

- [`api/src/modules/domains/document/api/rest/dto/document-navigation-response.dto.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/api/rest/dto/document-navigation-response.dto.ts:52)
- [`api/src/modules/domains/document/api/rest/dto/archived-document-list-response.dto.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/api/rest/dto/archived-document-list-response.dto.ts:44)

## Active Document Pagination

Active document cursor pagination is implemented in:

- [`api/src/modules/domains/document/app/use-cases/list-workspace-documents.use-case.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/app/use-cases/list-workspace-documents.use-case.ts:26)

The use case delegates document loading to:

- [`api/src/modules/domains/document/infra/mikro-orm-document-navigation-query.repository.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/infra/mikro-orm-document-navigation-query.repository.ts:39)

### Ordering

The repository returns active documents in stable ascending order:

- `sortKey ASC`
- `id ASC`

The `id` secondary key is important because it gives deterministic ordering when multiple documents share the same `sortKey`.

### Cursor Payload

The active document cursor is a base64url-encoded JSON object:

```json
{
  "id": "document-id",
  "sortKey": 1000
}
```

Encoding and decoding are implemented in:

- [`api/src/modules/domains/document/app/use-cases/list-workspace-documents.use-case.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/app/use-cases/list-workspace-documents.use-case.ts:149)

### Page Advancement

When a cursor is present, the next page starts strictly after the cursor position:

- include documents with `sortKey > cursor.sortKey`
- if `sortKey` is equal, include documents with `id > cursor.id`

This matches the repository ordering. The cursor therefore points to the last returned item, not the first item of the next page.

### Detecting Another Page

The use case slices `limit + 1` records:

1. load the visible documents after cursor filtering
2. take `limit + 1`
3. if an extra record exists, there is another page
4. return only the first `limit` items
5. build `nextCursor` from the last returned item

That means:

- `next_cursor` exists only when more results remain
- absence of `next_cursor` means the current page is the last page

## Archived Document Pagination

Archived document cursor pagination is implemented in:

- [`api/src/modules/domains/document/app/use-cases/list-archived-workspace-documents.use-case.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/app/use-cases/list-archived-workspace-documents.use-case.ts:22)

The repository loads archived documents with this stable descending order:

- `archivedAt DESC`
- `id DESC`

Reference:

- [`api/src/modules/domains/document/infra/mikro-orm-document-navigation-query.repository.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/infra/mikro-orm-document-navigation-query.repository.ts:63)

### Cursor Payload

The archived cursor is a base64url-encoded JSON object:

```json
{
  "id": "document-id",
  "archivedAt": 1720483200000
}
```

### Page Advancement

When a cursor is present, the next page contains older archived items:

- include documents with `archivedAt < cursor.archivedAt`
- if timestamps are equal, include documents with `id < cursor.id`

This matches the descending sort order and guarantees deterministic paging across ties.

## Grouped Root Navigation Behavior

The root document navigation endpoint has an important behavior difference:

- if `parent_document_id` is present, the response is one `DocumentNavigationPage`
- if `parent_document_id` is omitted, the response is grouped into:
  - `private_documents`
  - `teamspaces[].documents`

Reference:

- [`api/src/modules/domains/document/api/rest/document.controller.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/api/rest/document.controller.ts:142)
- [`api/src/modules/domains/document/app/use-cases/list-workspace-documents.use-case.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/app/use-cases/list-workspace-documents.use-case.ts:49)

This means the root navigation response is not one globally paginated document stream. Pagination is applied independently to:

- private root documents
- each teamspace root document page

The same incoming `cursor` value is passed into each page builder. In practice, that only behaves predictably when the cursor belongs to the same ordered subset being paged.

## Error Handling

If a cursor cannot be decoded or does not contain the expected shape, the use case throws `InvalidDocumentCursorError`.

References:

- [`api/src/modules/domains/document/app/errors/document-app.error.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/app/errors/document-app.error.ts:45)
- [`api/src/modules/domains/document/api/rest/document-http-error-mapper.ts`](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/src/modules/domains/document/api/rest/document-http-error-mapper.ts:44)

That error is returned to clients as:

- HTTP `400 Bad Request`

## Client Usage Pattern

The expected client flow is:

1. Request the first page without `cursor`.
2. Read `next_cursor` from the response.
3. Request the next page with `?cursor=...`.
4. Stop when `next_cursor` is absent.

Example:

```text
GET /workspaces/workspace-1/documents?parent_document_id=doc-1&limit=20
GET /workspaces/workspace-1/documents?parent_document_id=doc-1&limit=20&cursor=eyJpZCI6ImRvYy0yMCIsInNvcnRLZXkiOjIwMDAwfQ
```

Clients should treat the cursor as opaque and should not construct or modify it manually.

## Consumer Notes

This API is compatible with infinite-scroll or incremental-loading clients because:

- responses return `next_cursor` instead of page numbers
- the cursor points to the last returned item in a stable ordering
- clients can keep appending pages until `next_cursor` is absent

One important caveat remains: the root navigation endpoint returns grouped pages for `private_documents` and `teamspaces[].documents`, not one flat global stream. Consumers should paginate within a specific group, not assume a single cursor can advance every group at once.

## Implementation Tradeoffs

The current implementation is simple but has clear constraints:

- the repository loads the full matching ordered set first
- cursor filtering and `limit + 1` slicing happen in application memory
- this is straightforward to reason about
- this is less scalable than pushing cursor predicates and limit directly into SQL

This tradeoff is accepted in the current codebase and is recorded in [ADR-0002](./adr/0002-use-cursor-pagination-for-document-listing.md).
