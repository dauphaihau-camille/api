# Cross-Domain Infra Leakage

This document explains one of the easiest architectural mistakes to make in a modular backend: letting one domain depend directly on another domain's infrastructure internals.

In this codebase, that usually means one domain importing another domain's ORM entities, persistence adapters, or other implementation details from `infra/`.

This is a specific module import direction problem.

The broader rule is that modules should depend on stable public behavior rather than private implementation details. Cross-domain infra leakage is the domain-level version of that mistake: one domain reaches into another domain's internal storage or adapter layer instead of going through a contract, orchestrator, or event boundary.

## Why This Needs A Name

Without a clear name for the problem, it is easy to justify the coupling as a small convenience:

- "I only need one entity import"
- "I just need to check one relation"
- "This use case already has the entity manager"
- "Creating the foreign entity here is faster than adding a new port"

Each individual shortcut feels cheap. The cost shows up later when modules stop behaving like modules and start behaving like one large, entangled codebase.

Giving the problem a name makes it easier to catch in code review and easier to discuss without debating every individual import from scratch.

## What It Means

Cross-domain infra leakage happens when domain A depends on domain B through domain B's private implementation details rather than through domain B's public behavior.

Typical examples:

- `workspace` imports `document/infra/persistence/entities/document.entity`
- `document` imports `workspace/infra/persistence/entities/workspace.entity`
- an application port returns a foreign ORM entity
- a use case in one domain constructs and persists another domain's entity directly
- a domain module reaches into another domain's repository implementation instead of using a port or orchestration boundary

The key distinction is:

- depending on a domain's capability is normal
- depending on a domain's storage model is leakage

## The Real Problem

The problem is not that the imports look ugly.

The real problem is that the caller starts depending on facts it does not own:

- table shape
- persistence rules
- required fields
- default values
- relation wiring
- creation invariants
- indexing side effects
- transaction assumptions

Once that happens, the caller is no longer just using another domain. It is partially reimplementing it.

## A Concrete Mental Model

Imagine `document` owns the rules for how documents are created.

There are two ways `workspace` can get a default document created.

### Healthy Boundary

`workspace` says:

- "create the default document for this workspace"

That call goes through:

- a domain port
- an application orchestrator
- or an event such as `workspace.created`

`document` stays responsible for:

- required fields
- content defaults
- search text generation
- persistence shape
- side effects tied to document creation

### Leaky Boundary

`workspace` imports `DocumentEntity` and creates it directly.

Now `workspace` must know:

- which fields are required
- how default document content is shaped
- how search text is derived
- what the persistence relations look like
- what document invariants must be preserved

That is the real leak. `workspace` is no longer just asking for a document capability. It is acting like part of the `document` domain.

## Why Teams Care About This

Strong teams care because this coupling increases change cost in ways that are easy to underestimate early on.

### 1. Change Blast Radius Grows

If `document` changes its creation rules, persistence fields, or entity shape, code in `workspace` may also break even though the business change belongs only to `document`.

This turns local refactors into multi-module work.

### 2. Business Rules Get Duplicated

If multiple domains create or mutate foreign entities directly, each location may implement slightly different rules.

That leads to inconsistent behavior:

- one path sets a default
- another forgets it
- one path emits a side effect
- another silently skips it

### 3. Ownership Becomes Unclear

When foreign domains manipulate another domain's internals, it becomes hard to answer basic questions:

- who owns document creation rules?
- who validates teamspace membership assumptions?
- who is allowed to change workspace lookup behavior?

When ownership gets blurry, reviews get slower and bugs get harder to place.

### 4. Testing Gets Heavier

A use case that should only test one domain starts needing foreign entities, foreign repository wiring, and larger integration setup.

That makes tests:

- slower
- more brittle
- less focused

### 5. Refactors Become Politically Hard

If a module's internals are used all over the codebase, changing that module requires touching many call sites and coordinating across unrelated work.

At that point, teams stop refactoring not because the code is fine, but because the coupling makes change too expensive.

## What Counts As "Infra"

For this rule, "infra" includes:

- ORM entities
- repository implementations
- persistence adapters
- raw database helpers owned by one domain
- vendor SDK wrappers specific to one domain
- storage or transport details that belong to one domain's implementation

Examples of private implementation details:

- `domains/document/infra/persistence/entities/document.entity.ts`
- `domains/workspace/infra/mikro-orm-workspace.repository.ts`
- a repository class that exists only to satisfy one domain's internal persistence needs

These are not stable public contracts.

## What Is Usually Fine

Not all cross-domain dependency is bad.

These are generally acceptable:

- a domain depending on another domain's application-facing contract
- a use case calling a port exported by another domain
- a domain event consumed by another domain
- a composition root wiring multiple domains together
- shared generic primitives used by many domains

The healthy pattern is:

- depend on behavior
- hide implementation

## Simple Smell Tests

Use these quick checks in review.

### Import Smell

If a file under `domains/<x>/app` imports:

- `domains/<y>/infra/...`
- `domains/<y>/infra/persistence/entities/...`

that is usually leakage.

### Ownership Smell

If a file in one domain sets fields that clearly belong to another domain's business rules, that is usually leakage.

Examples:

- building another domain's default entity payload
- deciding foreign entity status transitions
- constructing foreign search or projection fields

### Port Smell

If an application port exposes ORM entities instead of domain-meaningful data, the boundary is weak.

For example, this is suspicious:

```ts
abstract class DocumentCommandRepository {
  abstract findCurrentUser(userId: string): Promise<UserEntity>;
}
```

The caller now depends on a foreign persistence type instead of a local contract.

## Preferred Alternatives

The right replacement depends on the kind of collaboration.

## 1. Use A Domain Contract

If one domain needs another domain's capability, expose a small contract shaped around the behavior.

Example:

```ts
export type WorkspaceAccess = {
  workspaceId: string;
  role: 'owner' | 'editor' | 'viewer';
};

export abstract class WorkspaceAccessPort {
  abstract getWorkspaceAccess(
    workspaceIdentifier: string,
    userId: string,
  ): Promise<WorkspaceAccess | null>;
}
```

This is better than returning `WorkspaceEntity` because the caller only receives the facts it actually needs.

## 2. Use An Application Orchestrator

If a workflow legitimately spans multiple domains, keep that workflow explicit in an application-level orchestrator or use case.

Example:

- `CreateWorkspaceWithDefaultsUseCase`

This use case can coordinate:

- workspace creation
- default document creation
- audit recording

without forcing one domain to construct another domain's internals.

## 3. Use Domain Events

If the second action is a follow-up side effect rather than part of the immediate return path, events can keep ownership cleaner.

Example:

- `workspace.created`
- `document` listens and creates a default document

This works best when the downstream action is allowed to be asynchronous or at least logically decoupled.

## 4. Return Small Data Shapes

When one domain needs data from another, prefer:

- value objects
- summaries
- lightweight policy results
- application DTOs

Prefer not to return:

- ORM entities
- entity manager-backed graphs
- raw vendor types

## A Practical Example

Suppose `workspace` needs to ensure a default document exists.

### Leaky Version

`workspace` imports:

- `DocumentEntity`
- `DEFAULT_CONTENT_FORMAT`
- document search text helpers

and then persists a document itself.

Problems:

- `workspace` now owns part of document creation behavior
- document changes will break workspace
- document side effects may be skipped or duplicated

### Cleaner Version

`workspace` creates the workspace and then:

- calls `CreateDefaultWorkspaceDocumentPort`
- or emits `workspace.created`

The `document` domain stays responsible for:

- document defaults
- document indexing fields
- document persistence rules

That keeps the dependency on behavior instead of storage details.

## When A Direct Dependency May Be Acceptable

Rare exceptions do exist.

Examples:

- a deliberate shared persistence model with explicit team agreement
- temporary migration code during a bounded refactor
- a composition-level module whose job is to wire multiple bounded areas together

But even then, the exception should be treated as exceptional:

- document why it exists
- keep the scope narrow
- avoid normalizing it as the default pattern

If the codebase starts accumulating many exceptions, the architecture rule is no longer real.

## How To Review A Suspected Leak

When you see a suspicious import, ask:

1. What capability is this code really trying to use?
2. Does it need behavior, or does it only have access to storage details?
3. Who should own this rule long term?
4. If the foreign domain changed its entity shape tomorrow, should this file need to change?

If the answer to the last question is "no, but it currently would", that is a boundary problem.

## Recommended Rule For This Repo

Use this as the default standard:

- domains may depend on another domain's stable contract or exported behavior
- domains should not import another domain's `infra/` or persistence entities directly
- application ports should expose domain-meaningful data, not foreign ORM entities
- cross-domain workflows should be handled with explicit orchestration, ports, or events

## Related Documents

- [API Project Structure](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/docs/project-structure.md)
- [Use Case Vs Service](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/docs/use-case-vs-service.md)
- [Layered Error Model](/Volumes/Local/dev/pj-personal/apps/camille/camille-v2/apps/api/api/docs/layered-error-model.md)
