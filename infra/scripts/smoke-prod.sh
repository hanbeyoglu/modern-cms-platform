#!/usr/bin/env bash
# Üretim / staging API için hızlı duman testi.
# Gereksinimler: curl, node (JSON parse için)
#
# Kullanım:
#   export API_BASE_URL=http://localhost:4000
#   export SMOKE_EMAIL=superadmin@example.com
#   export SMOKE_PASSWORD='SuperAdmin123!'
#   ./infra/scripts/smoke-prod.sh
#
# Public site-config için oturumdan tenant id alınır; ayrıca:
#   export SMOKE_TENANT_ID=<uuid>  (zorunlu değil — /auth/me yanıtından okunur)

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
SMOKE_EMAIL="${SMOKE_EMAIL:-superadmin@example.com}"
SMOKE_PASSWORD="${SMOKE_PASSWORD:-SuperAdmin123!}"

die() {
  echo "❌ $*" >&2
  exit 1
}

ok() { echo "✔ $*"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Komut bulunamadı: $1"
}

json_get() {
  node -e "
    const fs = require('fs');
    const j = JSON.parse(fs.readFileSync(0, 'utf8'));
    const path = process.argv[1].split('.');
    let cur = j;
    for (const p of path) {
      const k = /^[0-9]+$/.test(p) ? Number(p) : p;
      cur = cur?.[k];
    }
    if (cur === undefined || cur === null) process.exit(2);
    if (typeof cur === 'object') process.stdout.write(JSON.stringify(cur));
    else process.stdout.write(String(cur));
  " "$1"
}

require_cmd curl
require_cmd node

echo "==> API: ${API_BASE_URL}"

echo "==> GET /health"
H="$(curl -fsS "${API_BASE_URL}/health")" || die "/health isteği başarısız"
echo "$H" | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))" >/dev/null || die "/health geçerli JSON değil"
DB_STATUS="$(echo "$H" | json_get database)" || true
REDIS_STATUS="$(echo "$H" | json_get redis)" || true
[[ "$DB_STATUS" == "up" ]] || die "Veritabanı sağlık durumu: $DB_STATUS (beklenen: up)"
[[ "$REDIS_STATUS" == "up" || "$REDIS_STATUS" == "skipped" ]] || die "Redis sağlık durumu: $REDIS_STATUS"
ok "/health — database=${DB_STATUS} redis=${REDIS_STATUS}"

echo "==> GET /health/ready"
code="$(curl -s -o /tmp/smoke-ready.json -w "%{http_code}" "${API_BASE_URL}/health/ready")"
[[ "$code" == "200" ]] || die "/health/ready HTTP $code — $(cat /tmp/smoke-ready.json)"
ok "/health/ready HTTP 200"

echo "==> GET /version"
curl -fsS "${API_BASE_URL}/version" | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))" >/dev/null || die "/version geçersiz"
ok "/version"

echo "==> POST /auth/login"
LOGIN_JSON="$(curl -fsS -X POST "${API_BASE_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${SMOKE_PASSWORD}\"}")" || die "Login başarısız"

TOKEN="$(printf '%s' "$LOGIN_JSON" | json_get accessToken)" || die "accessToken alınamadı"
ok "Login — token alındı"

echo "==> GET /auth/me (korumalı rota)"
ME_JSON="$(curl -fsS "${API_BASE_URL}/auth/me" -H "Authorization: Bearer ${TOKEN}")" || die "/auth/me başarısız"
ok "/auth/me"

TENANT_ID="${SMOKE_TENANT_ID:-}"
if [[ -z "$TENANT_ID" ]]; then
  TENANT_ID="$(printf '%s' "$ME_JSON" | json_get tenants.0.id)" || die "Tenant id çıkarılamadı — SMOKE_TENANT_ID verin veya kullanıcıya tenant atayın"
fi
ok "Public test için tenantId=${TENANT_ID}"

echo "==> GET /public/site-config (public)"
curl -fsS "${API_BASE_URL}/public/site-config" \
  -H "x-tenant-id: ${TENANT_ID}" | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))" >/dev/null || die "/public/site-config başarısız"
ok "/public/site-config"

echo ""
echo "Tüm duman kontrolleri tamamlandı."
