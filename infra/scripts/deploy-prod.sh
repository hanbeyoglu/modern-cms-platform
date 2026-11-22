#!/usr/bin/env bash
# Run from an updated checkout. Optional arguments: api worker admin.
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_dir"
export COMPOSE_PARALLEL_LIMIT=1
compose=(docker compose --env-file "${CMS_ENV_FILE:-.env.production}" -f docker-compose.prod.yml)
services=("$@")
if [ ${#services[@]} -eq 0 ]; then services=(api worker admin); fi
needs_migration=false
for service in "${services[@]}"; do
  case "$service" in
    api|worker) needs_migration=true ;;
    admin) ;;
    *) echo "Unknown service: $service. Use api, worker or admin." >&2; exit 2 ;;
  esac
done

# Fail early without printing interpolated credentials.
"${compose[@]}" config --quiet
# Build sequentially so a 4 GB server is not compiling several images at once.
# Running application containers stay up throughout compilation.
for service in "${services[@]}"; do
  echo "Building $service..."
  "${compose[@]}" --progress plain build "$service"
done

if [ "$needs_migration" = true ]; then
  "${compose[@]}" up -d --wait postgres redis
  "${compose[@]}" --profile tools build migrate
  "${compose[@]}" --profile tools run --rm --no-deps --no-build migrate
fi

# Replace application containers only after every build and migration succeeds.
"${compose[@]}" up -d --no-deps --no-build --wait --wait-timeout 180 "${services[@]}"
"${compose[@]}" ps
