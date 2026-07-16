# Architecture Decision Records

This directory stores Architecture Decision Records for decisions that are important, debatable, and expensive to reverse later.

## When To Write An ADR

Write an ADR when a decision:

- affects multiple modules or layers
- introduces meaningful tradeoffs between valid options
- is likely to be questioned again later
- would be costly to reverse after more code depends on it

Good candidates in this repo include:

- persistence and indexing strategy
- module boundaries
- integration patterns with external systems
- cross-cutting runtime or operational architecture

Do not write an ADR for:

- endpoint walkthroughs
- obvious implementation details
- one-off bug fixes
- small refactors with no architectural tradeoff

## Status Values

Use one of:

- `Proposed`
- `Accepted`
- `Deprecated`
- `Superseded`

If an ADR replaces another one, link both records explicitly.

## File Naming

Use sequential numbering and a short slug:

```text
0001-use-postgres-full-text-search-for-documents.md
0002-keep-domain-workflows-in-use-case-classes.md
```

## Template

```md
# ADR-000X: Title

## Status

Accepted

## Date

YYYY-MM-DD

## Context

What problem are we solving? What constraints matter?

## Options Considered

### Option A: ...

- Pros:
- Cons:

### Option B: ...

- Pros:
- Cons:

## Decision

What we chose and why.

## Consequences

- Positive outcomes
- Negative outcomes
- Follow-up work or constraints we accept
```

## Current ADRs

- [ADR-0001: Use PostgreSQL full-text search for workspace document search](./0001-use-postgres-full-text-search-for-documents.md)
- [ADR-0002: Use cursor pagination for document listing](./0002-use-cursor-pagination-for-document-listing.md)
