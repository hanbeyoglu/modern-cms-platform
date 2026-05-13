#!/usr/bin/env bash
# Optional curl smoke against a running API (local or CI).
# Prerequisites: bash, curl, jq; API up; DB seeded (default superadmin from prisma/seed.ts).
#
# Usage:
#   API_BASE_URL=http://localhost:4000 ./infra/scripts/api-smoke.sh
#
# Env:
#   API_BASE_URL   (default http://localhost:4000)
#   SMOKE_EMAIL    (default superadmin@example.com)
#   SMOKE_PASSWORD (default SuperAdmin123!)

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
SMOKE_EMAIL="${SMOKE_EMAIL:-superadmin@example.com}"
SMOKE_PASSWORD="${SMOKE_PASSWORD:-SuperAdmin123!}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v jq >/dev/null 2>&1 || die "jq is required (brew install jq / apt install jq)"

echo "== GET ${API_BASE_URL}/health"
health="$(curl -sS -f "${API_BASE_URL}/health")" || die "/health failed"
echo "${health}" | jq .

echo "== POST ${API_BASE_URL}/auth/login"
login_json="$(curl -sS -f -X POST "${API_BASE_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${SMOKE_PASSWORD}\"}")" || die "/auth/login failed"
echo "${login_json}" | jq .

token="$(echo "${login_json}" | jq -r '.accessToken // empty')"
[[ -n "${token}" && "${token}" != "null" ]] || die "missing accessToken in login response"

auth_h=(-H "Authorization: Bearer ${token}")

echo "== GET ${API_BASE_URL}/auth/me"
curl -sS -f "${API_BASE_URL}/auth/me" "${auth_h[@]}" | jq .

echo "== GET ${API_BASE_URL}/tenants/my"
tenants_json="$(curl -sS -f "${API_BASE_URL}/tenants/my" "${auth_h[@]}")" || die "/tenants/my failed"
echo "${tenants_json}" | jq .

tenant_id="$(echo "${tenants_json}" | jq -r '.tenants[0].id // empty')"
[[ -n "${tenant_id}" && "${tenant_id}" != "null" ]] || die "no tenant in /tenants/my (seed DB?)"

tenant_h=(-H "x-tenant-id: ${tenant_id}")

echo "== GET ${API_BASE_URL}/malls/my (x-tenant-id)"
malls_json="$(curl -sS -f "${API_BASE_URL}/malls/my" "${auth_h[@]}" "${tenant_h[@]}")" || die "/malls/my failed"
echo "${malls_json}" | jq .

mall_id="$(echo "${malls_json}" | jq -r '.malls[0].id // empty')"
[[ -n "${mall_id}" && "${mall_id}" != "null" ]] || die "no mall in /malls/my for tenant ${tenant_id}"

mall_h=(-H "x-mall-id: ${mall_id}")

echo "== GET ${API_BASE_URL}/sliders (tenant + mall headers)"
curl -sS -f "${API_BASE_URL}/sliders" "${auth_h[@]}" "${tenant_h[@]}" "${mall_h[@]}" | jq . >/dev/null || die "/sliders failed"

echo "== GET ${API_BASE_URL}/events (tenant + mall headers)"
curl -sS -f "${API_BASE_URL}/events" "${auth_h[@]}" "${tenant_h[@]}" "${mall_h[@]}" | jq . >/dev/null || die "/events failed"

echo "== GET ${API_BASE_URL}/campaigns (tenant + mall headers)"
curl -sS -f "${API_BASE_URL}/campaigns" "${auth_h[@]}" "${tenant_h[@]}" "${mall_h[@]}" | jq . >/dev/null || die "/campaigns failed"

echo "OK: api-smoke finished"
