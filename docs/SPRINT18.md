# Sprint 18 — Yedekleme, gözlemlenebilirlik ve operasyonel güvenlik

**Durum:** Tamamlandı (operasyonel temel).  
**Kapsam dışı:** Kubernetes; tam Prometheus/Grafana yığını; Sentry kod entegrasyonu (yalnızca dokümantasyon).

## Özet

| Madde | Teslim |
|--------|--------|
| PostgreSQL yedek script | `infra/scripts/backup-postgres.sh` |
| PostgreSQL restore script | `infra/scripts/restore-postgres.sh` |
| Yedek budama | `infra/scripts/prune-backups.sh` |
| Meta dosyası | Her `.sql.gz` yanında `.sql.gz.meta.json` |
| pnpm komutları | `backup:postgres`, `restore:postgres`, `backup:prune` |
| CI | `bash -n` + `chmod`; isteğe bağlı `shellcheck` (PATH’te varsa) |
| Runbook | `docs/RUNBOOK.md` |
| Dağıtım genişletmesi | `docs/DEPLOYMENT.md` (yedek, uyarılar, medya) |
| Log kuralları | `docs/LOGGING.md` (+ API/worker hafif önek iyileştirmeleri) |

## Varsayımlar

- Yedekleme host’ta `pg_dump`, `gzip`, `psql`, `node` (meta JSON için) bulunur.
- `BACKUP_DIR` altında son klasör adı `postgres` olmalıdır (`prune-backups.sh` güvenlik kontrolü).
- Restore, hedef veritabanına yazan **yıkıcı** bir işlemdir; `CONFIRM_RESTORE=yes` zorunludur.

## Sınırlamalar

- Nesne depolama (S3/R2) senkronu yok; yalnızca dokümantasyon.
- Merkezi metrik / pano yok; uyarılar harici izleme (UptimeRobot, health check cron, host `df` vb.) ile tanımlanır.

## İlgili belgeler

- `docs/RUNBOOK.md` — günlük operasyon ve arıza
- `docs/DEPLOYMENT.md` — dağıtım + yedek + uyarı özeti
- `docs/LOGGING.md` — log alanları ve Sentry hazırlığı
