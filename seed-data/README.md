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
