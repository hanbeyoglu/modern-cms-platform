# Dağıtım Rehberi (Modern CMS)

Bu belge Sprint 17–18 ile güncellenmiştir. Amaç: tek VM / tek host üzerinde **Docker Compose** ile üretim benzeri dağıtım; Kubernetes veya Terraform yok.

## Bileşenler

| Servis   | Rol |
|----------|-----|
| `api`    | NestJS REST API |
| `admin`  | Vite build + nginx (statik SPA) |
| `worker` | Zamanlama tick’i (Prisma + Redis) |
| `postgres` | PostgreSQL 16 |
| `redis`    | Redis 7 (cache + worker sinyali) |

## Yerel geliştirme

1. `pnpm install`
2. `pnpm dev:services` (Postgres + Redis)
3. `pnpm db:migrate` ve isteğe bağlı `pnpm db:seed`
4. `pnpm dev`

Ortam değişkenleri için kök `.env.example` ve `apps/*/.env.example` dosyalarına bakın.

## Üretim / staging (Docker)

1. `.env.production.example` dosyasını `.env.production` olarak kopyalayın ve **güçlü parolalar** ile doldurun.
2. İmajları derleyin: `docker compose --env-file .env.production -f docker-compose.prod.yml build`
3. **Veritabanı migrasyonları**: Üretim `DATABASE_URL`’e ağ erişimi olan güvenilir bir ortamda (CI job, jump host veya geliştirici makinesi) şu komutu çalıştırın:

```bash
DATABASE_URL="postgresql://..." pnpm --filter @modern-cms/api exec prisma migrate deploy
```

API çalışma imajı `prisma` CLI içermez (yalnızca `@prisma/client`); migrasyonları release pipeline’ında API’yi yeniden başlatmadan önce uygulamak en güvenli modeldir.

4. Uygulamayı kaldırın: `docker compose --env-file .env.production -f docker-compose.prod.yml up -d`

## Sağlık uçları

| Uç | Amaç |
|----|------|
| `GET /health` | Liveness + JSON özet (DB, Redis, worker heartbeat, sürüm) |
| `GET /health/ready` | Readiness — DB ve (tanımlıysa) Redis için **503** dönebilir |
| `GET /version` | Sürüm / git SHA / build zamanı (metadata) |

## Duman testi

API ve bağımlılıklar ayaktayken:

```bash
export API_BASE_URL=https://api.example.com
export SMOKE_EMAIL=...
export SMOKE_PASSWORD=...
pnpm smoke:prod
```

Detaylar: `infra/scripts/smoke-prod.sh` ve `docs/SPRINT17.md`. Operasyonel adımlar: `docs/RUNBOOK.md`.

## PostgreSQL yedekleme ve geri yükleme

**Yedek** (`pg_dump` → gzip, zaman damgalı dosya + küçük meta JSON):

```bash
export DATABASE_URL="postgresql://..."
# İsteğe bağlı: APP_VERSION, APP_GIT_SHA veya GIT_SHA — meta dosyasına yazılır
pnpm backup:postgres
```

Dosyalar varsayılan olarak `backups/postgres/` altında: `cms-2026-05-14-140000.sql.gz` ve `cms-2026-05-14-140000.sql.gz.meta.json`.

**Eski yedekleri silme** (çöp kutusu: son klasör adı `postgres` olmalı; varsayılan saklama 14 gün):

```bash
BACKUP_RETENTION_DAYS=14 pnpm backup:prune
```

**Geri yükleme** (hedef veritabanının üzerine yazar):

```bash
export CONFIRM_RESTORE=yes
export DATABASE_URL="postgresql://..."
pnpm restore:postgres -- backups/postgres/<dosya>.sql.gz
```

Üretimde restore öncesi ek yedek alın; mümkünse yazma trafiğini durdurun.

## Medya (`storage/`)

- **Yerel disk:** API `STORAGE_ROOT` (varsayılan `storage/`) altındaki dosyalar DB kayıtlarıyla ilişkilidir. Yedek: veritabanı ile birlikte bu dizinin kopyalanması (rsync, volume anlık görüntüsü).
- **İleride S3 / Cloudflare R2:** Bucket yaşam döngüsü veya replikasyon; DB yedeği URL’leri korur, nesne içeriği ayrı yedeklenmelidir.
- **CDN:** Admin SPA ve API `/uploads` önünde CDN kullanılıyorsa purge / TTL stratejisi tanımlayın.

## Operasyonel uyarılar (özet)

Harici izleme veya cron ile önerilen koşullar: `/health/ready` ≠ 200; DB veya Redis down; worker heartbeat uzun süre yok; disk dolu; son başarılı yedek > 24 saat; deploy sonrası `pnpm smoke:prod` başarısız. Ayrıntı: `docs/RUNBOOK.md`.

## Olay müdahalesi ve loglama

- Runbook: `docs/RUNBOOK.md`.
- Log kuralları ve ileride Sentry: `docs/LOGGING.md`.

## CI

GitHub Actions `ci.yml`: shell script `bash -n` + çalıştırılabilir izin; PATH’te `shellcheck` varsa ek doğrulama; ardından kurulum, `prisma validate`, `migrate deploy` (CI Postgres), `typecheck`, `build`, Nest DI smoke, Compose config doğrulaması.

## Geri alma (rollback)

- Önceki imaj tag’lerine dönün: `docker compose ... up -d` öncesi kullandığınız digest veya sürüm etiketini tutun.
- Veritabanı: migrasyon geri alma için ters migration stratejisi veya yedekten dönüş planı tanımlayın; otomatik down migration yok. Yedek script’leri: `docs/SPRINT18.md`, `docs/RUNBOOK.md`.

## Güvenlik notları

- `JWT_SECRET` üretimde en az **32** karakter (API başlangıcında doğrulanır).
- Postgres ve Redis’i internete **açmayın** (`docker-compose.prod.yml` iç ağda `expose` kullanır).
- `.env.production` dosyasını asla repoya eklemeyin.
