compose_file := "infra/docker-compose.yml"
api_dir := "api"
mcp_dir := "tools/mcp"


# --------- Infrastructure

infra-up:
  docker compose -f {{ compose_file }} up -d

infra-down:
  docker compose -f {{ compose_file }} down

infra-fresh:
  docker compose -f {{ compose_file }} down -v
  docker compose -f {{ compose_file }} up -d

stack-up:
  cd {{ api_dir }} && \
  if [ ! -f ".env.docker" ] && [ -f ".env.docker.example" ]; then cp ".env.docker.example" ".env.docker"; fi && \
  cd .. && \
  docker compose -f {{ compose_file }} --profile app up -d --build

stack-down:
  docker compose -f {{ compose_file }} down


# --------- API app

api-install:
  @cd {{ api_dir }} && pnpm install

api-up environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  if [ ! -f "$env_file" ] && [ "$env_file" = ".env" ] && [ -f ".env.example" ]; then cp ".env.example" "$env_file"; fi && \
  test -f "$env_file" && \
  set -a && \
  . "$env_file" && \
  set +a && \
  pnpm start:dev

api-up-infisical project_id *env_name:
  cd {{ api_dir }} && \
  test -n "$INFISICAL_TOKEN" && \
  ENV_ARG='{{ if env_name != "" { "--env=" + env_name } else { "" } }}' && \
  pnpm exec infisical run --projectId="{{ project_id }}" $ENV_ARG --token="$INFISICAL_TOKEN" -- pnpm start:dev

api-up-observability environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  mkdir -p logs && \
  if [ ! -f "$env_file" ] && [ "$env_file" = ".env" ] && [ -f ".env.example" ]; then cp ".env.example" "$env_file"; fi && \
  test -f "$env_file" && \
  set -a && \
  . "$env_file" && \
  set +a && \
  LOG_PRETTY=false pnpm start:dev 2>&1 | tee logs/api.log

api-worker-up environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  if [ ! -f "$env_file" ] && [ "$env_file" = ".env" ] && [ -f ".env.example" ]; then cp ".env.example" "$env_file"; fi && \
  test -f "$env_file" && \
  set -a && \
  . "$env_file" && \
  set +a && \
  pnpm start:worker:dev

api-worker-up-infisical project_id *env_name:
  cd {{ api_dir }} && \
  test -n "$INFISICAL_TOKEN" && \
  ENV_ARG='{{ if env_name != "" { "--env=" + env_name } else { "" } }}' && \
  pnpm exec infisical run --projectId="{{ project_id }}" $ENV_ARG --token="$INFISICAL_TOKEN" -- pnpm start:worker:dev

api-worker-up-observability environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  mkdir -p logs && \
  if [ ! -f "$env_file" ] && [ "$env_file" = ".env" ] && [ -f ".env.example" ]; then cp ".env.example" "$env_file"; fi && \
  test -f "$env_file" && \
  set -a && \
  . "$env_file" && \
  set +a && \
  LOG_PRETTY=false pnpm start:worker:dev 2>&1 | tee logs/worker.log

# List environment variables from Infisical
api-env-infisical project_id *env_name:
  cd {{ api_dir }} && \
  test -n "$INFISICAL_TOKEN" && \
  ENV_ARG='{{ if env_name != "" { "--env=" + env_name } else { "" } }}' && \
  pnpm exec infisical run --projectId="{{ project_id }}" $ENV_ARG --token="$INFISICAL_TOKEN" -- env | sort


# --------- Migrations

db-migration-up environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  test -f "$env_file" && \
  set -a && \
  . "$env_file" && \
  set +a && \
  pnpm db:migration:up

db-migration-up-infisical project_id *env_name:
  cd {{ api_dir }} && \
  test -n "$INFISICAL_TOKEN" && \
  ENV_ARG='{{ if env_name != "" { "--env=" + env_name } else { "" } }}' && \
  pnpm exec infisical run --projectId="{{ project_id }}" $ENV_ARG --token="$INFISICAL_TOKEN" -- pnpm db:migration:up

db-migration-down environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  test -f "$env_file" && \
  set -a && \
  . "$env_file" && \
  set +a && \
  pnpm db:migration:down

db-migration-down-infisical project_id *env_name:
  cd {{ api_dir }} && \
  test -n "$INFISICAL_TOKEN" && \
  ENV_ARG='{{ if env_name != "" { "--env=" + env_name } else { "" } }}' && \
  pnpm exec infisical run --projectId="{{ project_id }}" $ENV_ARG --token="$INFISICAL_TOKEN" -- pnpm db:migration:down

db-migration-create environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  test -f "$env_file" && \
  set -a && \
  . "$env_file" && \
  set +a && \
  pnpm db:migration:create


# -------------------- Seeding

seed-full: db-clear
  just db-seed-demo

seed-full-infisical project_id *env_name:
  just db-clear-infisical {{project_id}} {{env_name}}
  just db-seed-demo-infisical {{project_id}} {{env_name}}

db-clear environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  test -f "$env_file" && \
  set -a && \
            . "$env_file" && \
    set +a && \
  pnpm db:clear

db-clear-infisical project_id *env_name:
  cd {{ api_dir }} && \
  test -n "$INFISICAL_TOKEN" && \
  ENV_ARG='{{ if env_name != "" { "--env=" + env_name } else { "" } }}' && \
  pnpm exec infisical run --projectId="{{ project_id }}" $ENV_ARG --token="$INFISICAL_TOKEN" -- pnpm db:clear

db-seed environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  test -f "$env_file" && \
  set -a && \
  . "$env_file" && \
  set +a && \
  pnpm db:seed

db-seed-infisical project_id *env_name:
  cd {{ api_dir }} && \
  test -n "$INFISICAL_TOKEN" && \
  ENV_ARG='{{ if env_name != "" { "--env=" + env_name } else { "" } }}' && \
  pnpm exec infisical run --projectId="{{ project_id }}" $ENV_ARG --token="$INFISICAL_TOKEN" -- pnpm db:seed

db-seed-demo environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  test -f "$env_file" && \
  set -a && \
  . "$env_file" && \
  set +a && \
  pnpm db:seed:demo

db-seed-demo-infisical project_id *env_name:
  cd {{ api_dir }} && \
  test -n "$INFISICAL_TOKEN" && \
  ENV_ARG='{{ if env_name != "" { "--env=" + env_name } else { "" } }}' && \
  pnpm exec infisical run --projectId="{{ project_id }}" $ENV_ARG --token="$INFISICAL_TOKEN" -- pnpm db:seed:demo

db-seed-huge environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  test -f "$env_file" && \
  set -a && \
  . "$env_file" && \
  set +a && \
  pnpm db:seed:huge

db-seed-huge-infisical project_id *env_name:
  cd {{ api_dir }} && \
  test -n "$INFISICAL_TOKEN" && \
  ENV_ARG='{{ if env_name != "" { "--env=" + env_name } else { "" } }}' && \
  pnpm exec infisical run --projectId="{{ project_id }}" $ENV_ARG --token="$INFISICAL_TOKEN" -- pnpm db:seed:huge

db-seed-realistic environment='':
  env_file="{{ if environment == "" { ".env" } else { ".env." + environment } }}"; \
  cd {{ api_dir }} && \
  test -f "$env_file" && \
  set -a && \
  . "$env_file" && \
  set +a && \
  pnpm db:seed:realistic

db-seed-realistic-infisical project_id *env_name:
  cd {{ api_dir }} && \
  test -n "$INFISICAL_TOKEN" && \
  ENV_ARG='{{ if env_name != "" { "--env=" + env_name } else { "" } }}' && \
  pnpm exec infisical run --projectId="{{ project_id }}" $ENV_ARG --token="$INFISICAL_TOKEN" -- pnpm db:seed:realistic

db-fresh environment='': db-clear
  just db-seed {{ environment }}

db-fresh-infisical project_id *env_name:
  just db-clear-infisical {{project_id}} {{env_name}}
  just db-seed-infisical {{project_id}} {{env_name}}

db-fresh-demo environment='': db-clear
  just db-seed-demo {{ environment }}

db-fresh-demo-infisical project_id *env_name:
  just db-clear-infisical {{project_id}} {{env_name}}
  just db-seed-demo-infisical {{project_id}} {{env_name}}

db-fresh-huge environment='': db-clear
  just db-seed-huge {{ environment }}

db-fresh-huge-infisical project_id *env_name:
  just db-clear-infisical {{project_id}} {{env_name}}
  just db-seed-huge-infisical {{project_id}} {{env_name}}

db-fresh-realistic environment='': db-clear
  just db-seed-realistic {{ environment }}

db-fresh-realistic-infisical project_id *env_name:
  just db-clear-infisical {{project_id}} {{env_name}}
  just db-seed-realistic-infisical {{project_id}} {{env_name}}


# -------------------- Etc

mcp-up:
  @cd {{ mcp_dir }} && pnpm start
