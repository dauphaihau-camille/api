#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
api_dir="$(cd "$script_dir/../.." && pwd)"
compose_file="${1:-$api_dir/../infra/docker-compose.yml}"
base_url="${BASE_URL:-http://127.0.0.1:3000}"
request_timeout="${REQUEST_TIMEOUT_SECONDS:-5}"
health_url="$base_url/health/ready"
env_file="${ENV_FILE:-$api_dir/.env}"
compose_app_env_file="$api_dir/.env.docker"

read_env_value() {
  local key="$1"

  if [[ ! -f "$env_file" ]]; then
    return 1
  fi

  awk -F= -v target="$key" '$1 == target { print substr($0, index($0, "=") + 1); exit }' "$env_file"
}

storage_driver="$(read_env_value STORAGE_DRIVER || true)"
storage_driver="${storage_driver:-local}"

forwarded_ip() {
  printf '203.0.113.%d' "$(( (RANDOM % 200) + 1 ))"
}

can_manage_compose_app_services() {
  [[ -f "$compose_app_env_file" ]]
}

require_api_ready_for_testing() {
  local status

  if ! status="$(curl -sS -o /tmp/camille-chaos-preflight-body.json -w '%{http_code}' --max-time "$request_timeout" "$health_url")"; then
    echo "API is not reachable at $base_url."
    echo "Start the API before running chaos tests."
    return 1
  fi

  if [[ "$status" == "000" ]]; then
    echo "API is not reachable at $base_url."
    echo "Start the API before running chaos tests."
    return 1
  fi
}

assert_ready_status() {
  local expected_status="$1"
  local response
  response="$(curl -sS -o /tmp/camille-ready-body.json -w '%{http_code}' --max-time "$request_timeout" "$health_url")"
  if [[ "$response" != "$expected_status" ]]; then
    echo "Expected /health/ready to return $expected_status, got $response"
    cat /tmp/camille-ready-body.json
    return 1
  fi
}

assert_register_status() {
  local expected_status="$1"
  local response
  response="$(curl -sS -o /tmp/camille-register-body.json -w '%{http_code}' --max-time "$request_timeout" \
    -H 'Content-Type: application/json' \
    -H "X-Forwarded-For: $(forwarded_ip)" \
    -d "{\"email\":\"chaos-$RANDOM@example.com\",\"password\":\"Password123!\",\"display_name\":\"Chaos Smoke\"}" \
    "$base_url/v1/auth/register")"
  if [[ "$response" != "$expected_status" ]]; then
    echo "Expected register call to return $expected_status, got $response"
    cat /tmp/camille-register-body.json
    return 1
  fi
}

assert_register_succeeds() {
  assert_register_status 201
}

chaos_case() {
  local service="$1"
  local expected_ready_status="$2"
  local expected_register_status="$3"

  echo "==> stopping $service"
  docker compose -f "$compose_file" stop "$service" > /dev/null

  echo "==> asserting readiness status $expected_ready_status"
  assert_ready_status "$expected_ready_status"

  echo "==> asserting bounded register outcome $expected_register_status"
  assert_register_status "$expected_register_status"

  echo "==> restarting $service"
  docker compose -f "$compose_file" start "$service" > /dev/null
  sleep 3
  assert_ready_status 200
}

readiness_only_chaos_case() {
  local service="$1"
  local expected_ready_status="$2"

  echo "==> stopping $service"
  docker compose -f "$compose_file" stop "$service" > /dev/null

  echo "==> asserting readiness status $expected_ready_status"
  assert_ready_status "$expected_ready_status"

  echo "==> asserting unaffected registration path"
  assert_register_succeeds

  echo "==> restarting $service"
  docker compose -f "$compose_file" start "$service" > /dev/null
  sleep 3
  assert_ready_status 200
}

main() {
  require_api_ready_for_testing
  assert_ready_status 200

  chaos_case postgres 503 500

  if [[ "$storage_driver" == "minio" ]]; then
    readiness_only_chaos_case minio 503
  else
    echo "==> skipping minio case because STORAGE_DRIVER=$storage_driver"
  fi

  chaos_case otel-collector 200 201

  if can_manage_compose_app_services; then
    chaos_case worker 200 201
  else
    echo "==> skipping worker case because $compose_app_env_file is missing"
  fi

  chaos_case redis 200 201

  echo "Chaos smoke completed."
}

main "$@"
