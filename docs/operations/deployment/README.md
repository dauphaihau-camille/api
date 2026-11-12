# API Deployment

The API is hosted on Render as an **image-backed service**: GitHub Actions builds the
Docker image, applies migrations, and Render only pulls and runs the image.

## Flow

```
push to production
  → CI validate, contract, e2e, integration
  → build linux/amd64 image, push ghcr.io/dauphaihau-camille/api:<sha> and :latest
  → run `pnpm db:migration:up` from that image against the production database
  → call the Render deploy hook with imgURL=<sha tag>
  → Render pulls the image and starts the API
```

The container never migrates. `CMD` is `pnpm start:prod`; local Docker Compose starts the
same image without migrations, so schema changes still come from the `justfile` targets.

## Files

| File | Role |
| --- | --- |
| [api/Dockerfile](../../../api/Dockerfile:1) | Build stage (dev deps, `pnpm build`) and runtime stage (prod deps, `dist`, `CMD pnpm start:prod`) |
| [api/.dockerignore](../../../api/.dockerignore:1) | Keeps `.env`, `node_modules`, `dist`, tests, and docs out of the build context |
| [.github/workflows/ci.yml](../../../.github/workflows/ci.yml:1) | `validate`, `contract`, `e2e`, `integration` gate `publish-image`: build + push, migrate, then trigger Render |
| [render.yaml](../../../render.yaml:1) | `runtime: image`, GHCR image URL, registry credential, health check |

## One-time setup

1. **Registry credential** — Workspace Settings → *Container Registry Credentials* → add a
   GitHub personal access token with `read:packages`, named `ghcr-read.` (matches the credential
   name in Render, trailing period included). Skip this if the GHCR package is public.
2. **Build source** — service *Settings* → *Build* → *Source* → *Edit* → choose the image
   source `ghcr.io/dauphaihau-camille/api:latest` with the credential from step 1. Switching the
   source is a Dashboard action; a Blueprint cannot do it for a service that was created
   from a Git repo. Render triggers a deploy with the new source.
3. **Start command — leave empty.** The image `CMD` is `pnpm start:prod`. Do not set a Render
   `dockerCommand`: Render does not give that field shell semantics, and a value like
   `sh -lc '…'` fails with `Exited with status 127`. Set the health check path to `/health`.
4. **Deploy hook** — service *Settings* → *Deploy Hook* → store the URL as the GitHub repo
   secret `RENDER_DEPLOY_HOOK_URL`.
5. **Infisical access for CI** — store a machine-identity token as the GitHub repo secret
   `INFISICAL_TOKEN` and the project id as `INFISICAL_PROJECT_ID` (repository variable or
   secret — the workflow reads either). The migrate step resolves the database settings from
   the `prod` environment of that project, so credentials are never duplicated into GitHub.
6. **Image URL** — keep the service's default image URL at
   `ghcr.io/dauphaihau-camille/api:latest`. The deploy hook only validates the tag, so every
   component of `imgURL` besides the tag must match this URL.

Until step 2 is done the deploy hook answers
`{"badrequest":"node environment does not support image URLs"}`, because the service is
still a native Node runtime and has no image to pull.

Render has no Git connection to this service, so `autoDeployTrigger` no longer applies.

## First release (bootstrap)

`publish-image` only runs for `refs/heads/production`, so the very first image has to be
pushed by hand — the Render source switch fails until `ghcr.io/dauphaihau-camille/api:latest`
exists, and the deploy hook rejects a native service until the switch is done.

```bash
# 1. Image must be amd64; Render does not run arm64. Use buildx, not the legacy builder.
docker buildx build \
  --platform linux/amd64 \
  --tag ghcr.io/dauphaihau-camille/api:latest \
  --tag "ghcr.io/dauphaihau-camille/api:$(git rev-parse HEAD)" \
  --push \
  api/api

# 2. Push needs a PAT with write:packages; CI's GITHUB_TOKEN is per-run only.
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin

# 3. Point the service at the image (step 2 above), then merge to production.
```

`docker push --all-tags` does not exist on all clients; `--push` pushes every `--tag` given to
`buildx build`. A PAT with only `read:packages` can log in but cannot push.

## Constraints

- **Migrations run before the deploy, not inside it.** The migrate step executes the image
  `pnpm db:migration:up` against the production database, then the deploy hook fires. A
  failing migration stops the job, so Render is never asked to deploy. A migration that
  succeeds followed by a failed deploy leaves the schema ahead of the running code — keep
  migrations backward compatible (expand/contract).
- **One migration per release.** `concurrency` cancels superseded pull-request runs but never
  a `production` run, and the `publish-image` job is serialised by its own group.
- **The migrate step forwards `DATABASE_URL` and the `DB_*` set.** The API accepts either
  (`src/platform/config/database.config.ts`), and MikroORM loads the compiled
  `dist/mikro-orm.config.js`, so the runtime image needs no TypeScript toolchain.
- **CI needs network access to Infisical and the database.** The migrate step runs on a
  GitHub runner, so the database must accept external connections.
- **Images must be `linux/amd64`.** The workflow pins `platforms: linux/amd64`. On Apple
  Silicon use `docker buildx build --platform linux/amd64 --push …`; the legacy `docker build`
  cannot cross-build and fails with `was found but does not provide the specified platform`.
- **Render pulls on every deploy, restart, and reschedule.** Never delete old `:<sha>` tags:
  Render rollbacks require the previous image to still exist in GHCR.
- **Runtime dependencies only.** The runtime stage installs production dependencies, so
  anything imported at runtime has to be a regular dependency (`@mikro-orm/cli` is, which is
  why the migrate step works).
- **No pretty logs.** The image sets `LOG_PRETTY=false` so production logs stay
  newline-delimited JSON for aggregation.

## Diagnostics

- `INFISICAL_TOKEN secret and INFISICAL_PROJECT_ID value are required` → configure them
  (step 5); nothing was deployed.
- `infisical run` fails with 401/403 → the machine identity is expired or lacks read access to
  the `prod` environment.
- Migrate step fails → Render is not triggered, the running deploy keeps serving; fix and
  re-run the job. Past this point the database may already be migrated: check
  `mikro_orm_migrations` before re-running.
- Deploy fails with `Image Pull Failed` → registry credential or tag missing.
- Deploy hook returns `{"badrequest":"node environment does not support image URLs"}` →
  the service is still a native runtime; switch its build source to the image (step 2).
- Deploy exits with status 127 and the log shows the whole start string as one `not found`
  command → a Render `dockerCommand` is set; clear it and let the image `CMD` run.
- Verify a rollout: the migrate step log ends with `Successfully migrated up to the latest
  version`, the Render event log shows the image pull for the pushed SHA, then `GET /health`
  returns 200.
