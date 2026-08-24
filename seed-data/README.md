Seed data for the template lives here.

Expected layout:

- `seed-data/auth-roles.tsv`
- `seed-data/auth-permissions.tsv`
- `seed-data/auth-role-permissions.tsv`
- `seed-data/auth-users.tsv`
- `seed-data/auth-users.local.tsv` (optional, local-only)

Rules:

- Auth reference data lives in `auth-roles.tsv`, `auth-permissions.tsv`, and `auth-role-permissions.tsv`.
- Demo users live in `auth-users.tsv`.
- Optional local-only users can live in `auth-users.local.tsv`.
- `email_verified` must be `true` or `false`.
- `role_key` must match a role seeded in `auth-roles.tsv`.
- `auth-users.local.tsv` is intended for machine-specific demo accounts and should stay out of version control.

Seed modes:

- `pnpm run db:seed` applies migrations and seeds reference data only.
- `pnpm run db:seed:demo` applies migrations and seeds reference data plus demo users.
- `pnpm run db:seed:huge` applies migrations, seeds auth data, and generates large synthetic workspace, teamspace, document, membership, publish, favorite, visit, subdoc-reference, and workspace-preference data.
- `pnpm run db:seed:realistic` applies migrations, seeds auth data, and generates a small set of scenario-based workspaces with realistic BlockNote content and subpage relationships.
- The realistic seed also creates deterministic workspace subscription rows for Free, Plus active, Plus canceling, Plus past-due, and block-limit upgrade-prompt checks.

Large synthetic seed configuration:

- `SEED_HUGE_USER_COUNT`
- `SEED_HUGE_WORKSPACE_COUNT`
- `SEED_HUGE_MEMBERS_PER_WORKSPACE`
- `SEED_HUGE_TEAMSPACES_PER_WORKSPACE`
- `SEED_HUGE_PRIVATE_ROOT_DOCUMENTS_PER_WORKSPACE`
- `SEED_HUGE_TEAMSPACE_ROOT_DOCUMENTS_PER_TEAMSPACE`
- `SEED_HUGE_CHILD_DOCUMENTS_PER_PARENT`
- `SEED_HUGE_DOCUMENT_DEPTH`
- `SEED_HUGE_FAVORITES_PER_USER`
- `SEED_HUGE_VISITS_PER_USER`
- `SEED_HUGE_PUBLISHED_DOCUMENTS_PER_WORKSPACE`
- `SEED_HUGE_SUBDOC_REFERENCES_PER_WORKSPACE`
- `SEED_HUGE_EXPANDED_DOCUMENTS_PER_PREFERENCE`
- `SEED_HUGE_BATCH_SIZE`
- `SEED_HUGE_DEFAULT_PASSWORD`

Realistic scenario seed configuration:

- `SEED_REALISTIC_WORKSPACE_REPLICAS`
- `SEED_REALISTIC_EXTRA_MEMBERS_PER_WORKSPACE`
- `SEED_REALISTIC_DEFAULT_PASSWORD`

Realistic subscription states:

- `Camille AI`: Plus active with fake Stripe provider IDs.
- `Northstar GTM AI`: Free collaborative with the 1,000 block limit.
- Replica `2` of `Camille AI`: Plus canceling.
- Replica `2` of `Northstar GTM AI`: Plus past due.
- `Seeded Block Limit Lab`: Free collaborative workspace seeded at exactly 1,000 content blocks.
- `Seeded Over Limit Lab`: Free collaborative workspace seeded at 1,200 content blocks for downgrade-style over-limit checks.
