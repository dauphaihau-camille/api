compose_file := "infra/docker-compose.yml"
api_dir := "api"
mcp_dir := "tools/mcp"

# --------- Private helpers

[private]
_compose-down volume_args='':
  docker compose -f {{ compose_file }} down {{ volume_args }}

[private]
_api-with-env command environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  test -f "$env_file" && \
  set -a && \
  . "$env_file" && \
  set +a && \
  {{ command }}

[private]
_api-with-default-env command environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  if [ ! -f "$env_file" ] && [ "$env_file" = ".env" ] && [ -f ".env.example" ]; then cp ".env.example" "$env_file"; fi && \
  test -f "$env_file" && \
  set -a && \
  . "$env_file" && \
  set +a && \
  {{ command }}

[private]
_api-with-infisical project_id env_name command:
  cd {{ api_dir }} && \
  test -n "$INFISICAL_TOKEN" && \
  ENV_ARG='{{ if env_name != "" { "--env=" + env_name } else { "" } }}' && \
  pnpm exec infisical run --projectId="{{ project_id }}" $ENV_ARG --token="$INFISICAL_TOKEN" -- {{ command }}


# --------- Infrastructure

infra-up:
  docker compose -f {{ compose_file }} up -d

infra-down:
  just _compose-down

infra-fresh:
  just _compose-down "-v"
  docker compose -f {{ compose_file }} up -d

stack-up:
  cd {{ api_dir }} && \
  if [ ! -f ".env.docker" ] && [ -f ".env.docker.example" ]; then cp ".env.docker.example" ".env.docker"; fi && \
  cd .. && \
  docker compose -f {{ compose_file }} --profile app up -d --build

stack-down:
  just _compose-down


# --------- API app

api-install:
  @cd {{ api_dir }} && pnpm install

api-up environment='':
  just _api-with-default-env "pnpm start:dev" "{{ environment }}"

api-up-infisical project_id *env_name:
  just _api-with-infisical "{{ project_id }}" "{{ env_name }}" "pnpm start:dev"

api-up-observability environment='':
  just _api-with-default-env "mkdir -p logs && LOG_PRETTY=false pnpm start:dev 2>&1 | tee logs/api.log" "{{ environment }}"

api-worker-up environment='':
  just _api-with-default-env "pnpm start:worker:dev" "{{ environment }}"

api-worker-up-infisical project_id *env_name:
  just _api-with-infisical "{{ project_id }}" "{{ env_name }}" "pnpm start:worker:dev"

api-worker-up-observability environment='':
  just _api-with-default-env "mkdir -p logs && LOG_PRETTY=false pnpm start:worker:dev 2>&1 | tee logs/worker.log" "{{ environment }}"

# List environment variables from Infisical.
api-env-infisical project_id *env_name:
  just _api-with-infisical "{{ project_id }}" "{{ env_name }}" "env | sort"


# --------- Migrations

db-migration-up environment='':
  just _api-with-env "pnpm db:migration:up" "{{ environment }}"

db-migration-up-infisical project_id *env_name:
  just _api-with-infisical "{{ project_id }}" "{{ env_name }}" "pnpm db:migration:up"

db-migration-down environment='':
  just _api-with-env "pnpm db:migration:down" "{{ environment }}"

db-migration-down-infisical project_id *env_name:
  just _api-with-infisical "{{ project_id }}" "{{ env_name }}" "pnpm db:migration:down"

db-migration-create environment='':
  just _api-with-env "pnpm db:migration:create" "{{ environment }}"


# -------------------- Seeding

seed-full environment='':
  just db-clear {{ environment }}
  just db-seed-demo {{ environment }}

seed-full-infisical project_id *env_name:
  just db-clear-infisical {{ project_id }} {{ env_name }}
  just db-seed-demo-infisical {{ project_id }} {{ env_name }}

db-clear environment='':
  just _api-with-env "pnpm db:clear" "{{ environment }}"

db-clear-infisical project_id *env_name:
  just _api-with-infisical "{{ project_id }}" "{{ env_name }}" "pnpm db:clear"

db-seed environment='':
  just _api-with-env "pnpm db:seed" "{{ environment }}"

db-seed-infisical project_id *env_name:
  just _api-with-infisical "{{ project_id }}" "{{ env_name }}" "pnpm db:seed"

db-seed-demo environment='':
  just _api-with-env "pnpm db:seed:demo" "{{ environment }}"

db-seed-demo-infisical project_id *env_name:
  just _api-with-infisical "{{ project_id }}" "{{ env_name }}" "pnpm db:seed:demo"

db-seed-huge environment='':
  just _api-with-env "pnpm db:seed:huge" "{{ environment }}"

db-seed-huge-infisical project_id *env_name:
  just _api-with-infisical "{{ project_id }}" "{{ env_name }}" "pnpm db:seed:huge"

db-seed-realistic environment='':
  just _api-with-env "pnpm db:seed:realistic" "{{ environment }}"

db-seed-realistic-infisical project_id *env_name:
  just _api-with-infisical "{{ project_id }}" "{{ env_name }}" "pnpm db:seed:realistic"

db-fresh environment='':
  just db-clear {{ environment }}
  just db-seed {{ environment }}

db-fresh-infisical project_id *env_name:
  just db-clear-infisical {{ project_id }} {{ env_name }}
  just db-seed-infisical {{ project_id }} {{ env_name }}

db-fresh-demo environment='':
  just db-clear {{ environment }}
  just db-seed-demo {{ environment }}

db-fresh-demo-infisical project_id *env_name:
  just db-clear-infisical {{ project_id }} {{ env_name }}
  just db-seed-demo-infisical {{ project_id }} {{ env_name }}

db-fresh-huge environment='':
  just db-clear {{ environment }}
  just db-seed-huge {{ environment }}

db-fresh-huge-infisical project_id *env_name:
  just db-clear-infisical {{ project_id }} {{ env_name }}
  just db-seed-huge-infisical {{ project_id }} {{ env_name }}

db-fresh-realistic environment='':
  just db-clear {{ environment }}
  just db-seed-realistic {{ environment }}

db-fresh-realistic-infisical project_id *env_name:
  just db-clear-infisical {{ project_id }} {{ env_name }}
  just db-seed-realistic-infisical {{ project_id }} {{ env_name }}


# -------------------- Etc

mcp-up:
  @cd {{ mcp_dir }} && pnpm start
