# Dağıtım Rehberi (Modern CMS)

Amaç: tek VM / tek host üzerinde **Docker Compose** ile üretim benzeri dağıtım; Kubernetes veya Terraform yok.

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
2. `pnpm db:generate` (Prisma Client; `turbo typecheck` da bunu tetikler, ancak tek başına paket çalıştırırken gerekli olabilir)
3. `pnpm dev:services` (Postgres + Redis)
4. `pnpm db:migrate` ve isteğe bağlı `pnpm db:seed`
5. `pnpm dev`

Ortam değişkenleri için kök `.env.example` ve `apps/*/.env.example` dosyalarına bakın.

## Üretim / staging (Docker)

1. `.env.production.example` dosyasını `.env.production` olarak kopyalayın ve **güçlü parolalar** ile doldurun.
2. İmajları derleyin: `docker compose --env-file .env.production -f docker-compose.prod.yml build`
3. **Veritabanı migrasyonları**: Yeni API'yi başlatmadan önce, sunucuda production ayarlarıyla çalıştırın. Compose içindeki Postgres kullanılıyorsa önce `postgres` servisini başlatın.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile tools run --build --rm migrate
```

`migrate`, Prisma CLI bulunan Docker build aşamasını kullanır ve `.env.production` içindeki `DATABASE_URL` veritabanına bekleyen migration'ları uygular. API çalışma imajı CLI içermez. Komut hata verirse yeni API'yi başlatmadan önce migration hatasını çözün; üretimde `migrate reset` kullanmayın.

`/public/movies` çağrısında PostgreSQL `22P02: invalid input value for enum "LocalizedEntityType": "MOVIE_CATEGORY"` hatası, uygulamanın kategori çevirisini sorguladığı fakat `20261121120000_movie_category_localization` migration'ının hedef veritabanına uygulanmadığı anlamına gelir. Yukarıdaki komutla migration'ı uygulayın; ardından aynı isteği tekrar deneyin. Bu düzeltme için film sorgusunu veya kategori çevirilerini kaldırmak gerekmez.

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

Detaylar: `infra/scripts/smoke-prod.sh`. Operasyonel adımlar: `docs/RUNBOOK.md`.

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
- **Cloudflare R2:** Bucket yaşam döngüsü veya replikasyon; DB yedeği URL’leri korur, nesne içeriği ayrı yedeklenmelidir.
- **CDN:** Admin SPA ve API `/uploads` önünde CDN kullanılıyorsa purge / TTL stratejisi tanımlayın.

## Operasyonel uyarılar (özet)

Harici izleme veya cron ile önerilen koşullar: `/health/ready` ≠ 200; DB veya Redis down; worker heartbeat uzun süre yok; disk dolu; son başarılı yedek > 24 saat; deploy sonrası `pnpm smoke:prod` başarısız. Ayrıntı: `docs/RUNBOOK.md`.

## Olay müdahalesi ve loglama

- Runbook: `docs/RUNBOOK.md`.
- Log kuralları ve ileride Sentry: `docs/LOGGING.md`.

## CI ve Docker (GitHub Actions)

| Workflow dosyası | Görünen ad | Ne zaman çalışır |
|------------------|------------|------------------|
| `.github/workflows/ci.yml` | **Build and test** | `main` dalına **push**; tüm **pull request**’ler |
| `.github/workflows/docker.yml` | **Docker images** | **Elle** (`workflow_dispatch`); `v*` biçiminde **sürüm etiketi** push’u (örn. `v1.2.0`) |

Her iki workflow’da **concurrency** vardır: aynı dal/ref için yeni commit gelince önceki çalışma iptal edilir; gereksiz e-posta ve kuyruk gürültüsü azalır.

### Sürüm / imaj akışı

- **Normal commit:** `main` dışındaki dallara doğrudan **push** CI başlatmaz. **Pull request** açıldığında veya güncellendiğinde **Build and test** çalışır. `main`’e merge sonrası push yalnızca `main` için CI tetiklenir. **Docker images** bu akışta çalışmaz.
- **Sürüm etiketi** (`v1.0.0` gibi): `git tag` + `git push origin v1.0.0` ile **Docker images** çalışır; imaj derlemesi ve compose doğrulaması burada yapılır.
- **Manuel deneme:** Actions sekmesinden **Docker images** → *Run workflow*.

`ci.yml` içeriği: `infra/scripts/*.sh` için `bash -n` + çalıştırılabilir izin; ardından `pnpm install`, **`pnpm db:generate`** (Prisma Client — `apps/api/prisma/schema.prisma` kaynağı; `typecheck` / `build` öncesi zorunlu), `prisma validate`, `migrate deploy` (CI Postgres), `typecheck`, `pnpm build`, açıkça `pnpm --filter @modern-cms/api build`, Nest DI smoke (`pnpm --filter @modern-cms/api run smoke:di:dist`, derlenmiş `dist/smoke-di.js` — `tsx` yok), Compose config doğrulaması.

**Prisma Client ve CI:** `@prisma/client` içindeki `PrismaClient` tipleri `prisma generate` sonrası oluşur. Turbo pipeline’da tüm `typecheck` / `build` / `lint` görevleri `@modern-cms/api#db:generate` sonrasına bağlıdır; yine de CI’da `pnpm install` hemen ardından açıkça `pnpm db:generate` çalıştırılır (önbellek veya sıra farklarına karşı).

## Geri alma (rollback)

- Önceki imaj tag’lerine dönün: `docker compose ... up -d` öncesi kullandığınız digest veya sürüm etiketini tutun.
- Veritabanı: migrasyon geri alma için ters migration stratejisi veya yedekten dönüş planı tanımlayın; otomatik down migration yok. Yedek script’leri: `docs/RUNBOOK.md`.

## Güvenlik notları

- `JWT_SECRET` üretimde en az **32** karakter (API başlangıcında doğrulanır).
- Postgres ve Redis’i internete **açmayın** (`docker-compose.prod.yml` iç ağda `expose` kullanır).
- `.env.production` dosyasını asla repoya eklemeyin.

## Üretim ortamı ve medya

`.env.production.example` yalnızca örnek değerler içerir; gerçek anahtarları `.env.production`
dosyasında saklayın. Bu dosya Git ve Docker build bağlamından dışlanır.
Compose, R2 ve TMDB ayarlarını API'ye aktarır. R2 kullanılmıyorsa yerel medya
`modern-cms-media-data` volume'unda saklanır; bu volume'u da yedekleyin.
OpenAPI üretimi veritabanı, Redis veya gerçek JWT anahtarı gerektirmez.
