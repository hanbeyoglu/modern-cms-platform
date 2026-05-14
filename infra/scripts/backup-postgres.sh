#!/usr/bin/env bash
# PostgreSQL yedekleme: pg_dump → gzip. DATABASE_URL veya PG* ortam değişkenleri.
#
# Ortam:
#   DATABASE_URL          — tercih edilen (postgresql://...)
#   veya PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
#   BACKUP_DIR            — varsayılan: backups/postgres
#   APP_VERSION, APP_GIT_SHA / GIT_SHA — meta dosyası için (isteğe bağlı)
#
# Çıktı örneği: backups/postgres/cms-2026-05-14-140000.sql.gz
# Yanında:    backups/postgres/cms-2026-05-14-140000.sql.gz.meta.json

set -euo pipefail

die() {
  echo "[backup-postgres] ERROR: $*" >&2
  exit 1
}

info() {
  echo "[backup-postgres] $*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Komut bulunamadı: $1"
}

require_cmd pg_dump
require_cmd gzip
command -v node >/dev/null 2>&1 || die "meta.json için node gerekli"

BACKUP_DIR="${BACKUP_DIR:-backups/postgres}"
mkdir -p "$BACKUP_DIR" || die "BACKUP_DIR oluşturulamadı: $BACKUP_DIR"

DBNAME=""
if [[ -n "${DATABASE_URL:-}" ]]; then
  DBNAME="$(node -e "
    try {
      const u = new URL(process.env.DATABASE_URL || '');
      const path = (u.pathname || '/').replace(/^\\//, '').split('?')[0];
      console.log(path || 'postgres');
    } catch { process.exit(1); }
  ")" || die "DATABASE_URL ayrıştırılamadı"
  export PGCLIENTENCODING="${PGCLIENTENCODING:-UTF8}"
else
  : "${PGHOST:?PGHOST veya DATABASE_URL gerekli}"
  : "${PGUSER:?PGUSER veya DATABASE_URL gerekli}"
  : "${PGDATABASE:?PGDATABASE veya DATABASE_URL gerekli}"
  export PGHOST PGPORT="${PGPORT:-5432}" PGUSER PGPASSWORD="${PGPASSWORD:-}" PGDATABASE
  DBNAME="$PGDATABASE"
fi

# Dosya adı için güvenli kısa ad
SAFE_DB="$(echo "$DBNAME" | tr -cd '[:alnum:]_-' | cut -c1-64)"
[[ -n "$SAFE_DB" ]] || SAFE_DB="db"

TS="$(date +%Y-%m-%d-%H%M%S)"
BASE="${BACKUP_DIR}/${SAFE_DB}-${TS}"
OUT="${BASE}.sql.gz"
META="${BASE}.sql.gz.meta.json"
TMP="${OUT}.part"

info "Veritabanı adı: $DBNAME"
info "Hedef dosya: $OUT"

if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump "$DATABASE_URL" --no-owner --no-acl --format=p | gzip -n >"$TMP"
else
  pg_dump --no-owner --no-acl --format=p | gzip -n >"$TMP"
fi

mv "$TMP" "$OUT"

SIZE_BYTES="$(wc -c <"$OUT" | tr -d ' ')"
APP_VERSION="${APP_VERSION:-unknown}"
GIT_SHA="${APP_GIT_SHA:-${GIT_SHA:-unknown}}"
TS_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

node -e "
  const fs = require('fs');
  const meta = {
    timestamp: process.env.TS_ISO,
    appVersion: process.env.APP_VERSION,
    gitSha: process.env.GIT_SHA,
    database: process.env.DBNAME,
    backupFile: process.env.OUT_BASENAME,
    backupSizeBytes: Number(process.env.SIZE_BYTES),
  };
  fs.writeFileSync(process.env.META_OUT, JSON.stringify(meta, null, 2) + '\\n', 'utf8');
" \
  TS_ISO="$TS_ISO" \
  APP_VERSION="$APP_VERSION" \
  GIT_SHA="$GIT_SHA" \
  DBNAME="$DBNAME" \
  OUT_BASENAME="$(basename "$OUT")" \
  SIZE_BYTES="$SIZE_BYTES" \
  META_OUT="$META"

info "Tamamlandı. Boyut: ${SIZE_BYTES} bayt"
info "Meta: $META"
