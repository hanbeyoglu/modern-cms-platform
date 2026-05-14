# Dağıtım Rehberi (Modern CMS)

Bu belge Sprint 17 ile güncellenmiştir. Amaç: tek VM / tek host üzerinde **Docker Compose** ile üretim benzeri dağıtım; Kubernetes veya Terraform yok.

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

Detaylar: `infra/scripts/smoke-prod.sh` ve `docs/SPRINT17.md`.

## CI

GitHub Actions `ci.yml`: kurulum, `prisma validate`, `migrate deploy` (CI Postgres), `typecheck`, `build`, Nest DI smoke, Compose config doğrulaması.

## Geri alma (rollback)

- Önceki imaj tag’lerine dönün: `docker compose ... up -d` öncesi kullandığınız digest veya sürüm etiketini tutun.
- Veritabanı: migrasyon geri alma için ters migration stratejisi veya yedekten dönüş planı tanımlayın (otomasyon bu repoda yok).

## Güvenlik notları

- `JWT_SECRET` üretimde en az **32** karakter (API başlangıcında doğrulanır).
- Postgres ve Redis’i internete **açmayın** (`docker-compose.prod.yml` iç ağda `expose` kullanır).
- `.env.production` dosyasını asla repoya eklemeyin.
