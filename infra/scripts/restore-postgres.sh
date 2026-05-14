#!/usr/bin/env bash
# PostgreSQL geri yükleme — YIKICI: hedef veritabanının içeriğinin üzerine yazar.
#
# Kullanım:
#   CONFIRM_RESTORE=yes DATABASE_URL="postgresql://..." \
#     ./infra/scripts/restore-postgres.sh backups/postgres/cms-2026-05-14-140000.sql.gz
#
# Gereksinimler: gunzip (veya gzip -dc), psql, DATABASE_URL veya tam PG* seti
#
# DATABASE_URL yoksa: PGHOST, PGUSER, PGDATABASE ve isteğe bağlı PGPORT, PGPASSWORD

set -euo pipefail

die() {
  echo "[restore-postgres] ERROR: $*" >&2
  exit 1
}

warn() {
  echo "[restore-postgres] WARN: $*" >&2
}

info() {
  echo "[restore-postgres] $*"
}

BACKUP_FILE="${1:-}"
[[ -n "$BACKUP_FILE" ]] || die "Kullanım: $0 <yedek.sql.gz dosyası>"
[[ -f "$BACKUP_FILE" ]] || die "Dosya bulunamadı: $BACKUP_FILE"

[[ "${CONFIRM_RESTORE:-}" == "yes" ]] ||
  die "Geri yükleme için ortam değişkeni ayarlayın: CONFIRM_RESTORE=yes (büyük/küçük harf duyarlı)"

command -v psql >/dev/null 2>&1 || die "psql bulunamadı"
if command -v gunzip >/dev/null 2>&1; then
  DECOMPRESS=(gunzip -c)
elif command -v gzip >/dev/null 2>&1; then
  DECOMPRESS=(gzip -dc)
else
  die "gunzip veya gzip gerekli"
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  :
else
  : "${PGHOST:?DATABASE_URL veya PGHOST gerekli}"
  : "${PGUSER:?PGUSER gerekli}"
  : "${PGDATABASE:?PGDATABASE gerekli}"
  export PGHOST PGPORT="${PGPORT:-5432}" PGUSER PGPASSWORD="${PGPASSWORD:-}" PGDATABASE
fi

echo ""
warn "============================================================"
warn " DİKKAT: Bu işlem hedef veritabanındaki verilerin üzerine yazar."
warn " Üretimde önce ek yedek alın. Yedek dosyası: $BACKUP_FILE"
warn "============================================================"
echo ""

info "Geri yükleme başlıyor..."
# stdin üzerinden SQL: ON_ERROR_STOP ile hata durumunda çıkış
if [[ -n "${DATABASE_URL:-}" ]]; then
  "${DECOMPRESS[@]}" "$BACKUP_FILE" | psql -v ON_ERROR_STOP=1 "$DATABASE_URL"
else
  "${DECOMPRESS[@]}" "$BACKUP_FILE" | psql -v ON_ERROR_STOP=1
fi

info "Geri yükleme tamamlandı."
