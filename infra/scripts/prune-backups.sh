#!/usr/bin/env bash
# Eski .sql.gz yedeklerini siler. BACKUP_RETENTION_DAYS (varsayılan 14) üzeri yaştakiler.
#
# Güvenlik: BACKUP_DIR çözümlenmiş yolun son bileşeni tam olarak "postgres" olmalıdır.

set -euo pipefail

die() {
  echo "[prune-backups] ERROR: $*" >&2
  exit 1
}

info() {
  echo "[prune-backups] $*"
}

BACKUP_DIR="${BACKUP_DIR:-backups/postgres}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

[[ "$BACKUP_RETENTION_DAYS" =~ ^[0-9]+$ ]] || die "BACKUP_RETENTION_DAYS pozitif tam sayı olmalı"
((BACKUP_RETENTION_DAYS >= 1)) || die "BACKUP_RETENTION_DAYS en az 1 olmalı"

mkdir -p "$BACKUP_DIR" 2>/dev/null || true
ABS="$(cd "$BACKUP_DIR" && pwd)" || die "BACKUP_DIR erişilemiyor: $BACKUP_DIR"

BASE="$(basename "$ABS")"
[[ "$BASE" == "postgres" ]] ||
  die "Güvenlik: BACKUP_DIR son klasör adı 'postgres' olmalı (şu an: '$BASE'). Yanlış dizine silme uygulanmasın."

info "Dizin: $ABS"
info "Eşik: ${BACKUP_RETENTION_DAYS} günden eski *.sql.gz dosyaları silinecek"

# GNU find (Linux, Git Bash)
DELETED=0
while IFS= read -r -d '' f; do
  info "Siliniyor: $f"
  rm -f "$f"
  # eş meta dosyası
  [[ -f "${f}.meta.json" ]] && rm -f "${f}.meta.json"
  DELETED=$((DELETED + 1))
done < <(find "$ABS" -maxdepth 1 -type f -name '*.sql.gz' -mtime "+${BACKUP_RETENTION_DAYS}" -print0)

info "Silinen yedek sayısı: $DELETED"
