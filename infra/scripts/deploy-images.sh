#!/usr/bin/env bash
# Deploy a validated release manifest. No application build runs on this server.
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_dir"
release_file="${1:?Release JSON file required}"
prefix="${CMS_IMAGE_PREFIX:-ghcr.io/hanbeyoglu/modern-cms-platform}"
state_dir="${CMS_RELEASE_DIR:-$repo_dir/.deploy}"
mkdir -p "$state_dir"
exec 9>"$state_dir/deploy.lock"
flock -n 9 || { echo 'Another deployment is running' >&2; exit 1; }

# Never source/eval artifact contents: only validated image references are exported.
settings="$(python3 infra/scripts/release-plan.py --prefix "$prefix" --validate "$release_file")"
while IFS='=' read -r key value; do
  case "$key" in
    CMS_API_IMAGE|CMS_WORKER_IMAGE|CMS_ADMIN_IMAGE|CMS_MIGRATE_IMAGE) export "$key=$value" ;;
    RELEASE_SERVICES) read -r -a services <<< "$value" ;;
    RELEASE_SHA) release_sha="$value" ;;
  esac
done <<< "$settings"
[[ "$(git rev-parse HEAD)" == "$release_sha" ]] || { echo 'Checkout does not match release SHA' >&2; exit 1; }
compose=(docker compose --env-file "${CMS_ENV_FILE:-.env.production}" -f docker-compose.prod.yml)
"${compose[@]}" config --quiet
if [ ${#services[@]} -gt 0 ]; then
  "${compose[@]}" pull "${services[@]}"
  if [[ " ${services[*]} " == *' api '* || " ${services[*]} " == *' worker '* ]]; then
    "${compose[@]}" --profile tools pull migrate
    "${compose[@]}" up -d --wait postgres redis
    "${compose[@]}" --profile tools run --rm --no-deps --no-build migrate
  fi
  "${compose[@]}" up -d --no-deps --no-build --wait --wait-timeout 180 "${services[@]}"
fi
# Commit deployment state only after migrations and health checks succeeded.
if [ -f "$state_dir/current.json" ]; then cp "$state_dir/current.json" "$state_dir/previous.json"; fi
cp "$release_file" "$state_dir/current.json.tmp"
mv "$state_dir/current.json.tmp" "$state_dir/current.json"
"${compose[@]}" ps
