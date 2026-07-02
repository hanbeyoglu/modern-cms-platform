# modern-cms

CMS yönetim platformu için monorepo iskeleti: API (NestJS), Admin (React + Vite), arka plan işçisi ve paylaşılan paketler.

## Mimari özeti

- **apps/api**: CMS HTTP API (ileride kamuya açık siteler de aynı API’yi tüketebilir; CORS kökenleri ortam değişkeni ile yönetilir).
- **apps/admin**: Dahili yönetim arayüzü.
- **apps/worker**: Kuyruk/arka plan işleri için minimal TypeScript süreci.
- **packages/shared**: Ortak tipler ve enumlar.
- **packages/ui**: Paylaşılan React bileşenleri.
- **packages/config**: Ortak TypeScript temel yapılandırmaları.

## Gereksinimler

- Node.js 20+
- pnpm 9 (`corepack enable` önerilir)
- Docker (isteğe bağlı, compose ile)

## Frontend / Public API

Bağımsız web, mobil veya kiosk arayüzü geliştiren ekipler için:

- [docs/PUBLIC_API_GUIDE.md](docs/PUBLIC_API_GUIDE.md) — Public API rehberi (uçlar, envelope, slider, medya, örnekler)
- [docs/FRONTEND_HANDOFF.md](docs/FRONTEND_HANDOFF.md) — Kısa teslim checklist’i
- [`@modern-cms/public-sdk`](packages/public-sdk/) — TypeScript istemci

## Developer Portal

API dokümantasyonu NestJS OpenAPI spesifikasyonundan otomatik üretilir. OpenAPI tek kaynak (single source of truth) — elle düzenleme yapılmaz.

| URL | Açıklama |
|-----|----------|
| `/developer` | Scalar Developer Portal — frontend geliştiriciler için ana dokümantasyon (arama, playground, kod örnekleri) |
| `/api/docs` | Swagger UI — interaktif OpenAPI gezgini |
| `/openapi.json` | Ham OpenAPI 3.1 JSON — **Türkçe** (varsayılan) |
| `/openapi.en.json` | OpenAPI 3.1 — **English** |
| `/openapi.ru.json` | OpenAPI 3.1 — **Русский** |

Yerelde (varsayılan port): http://localhost:4000/developer

Ayrıntılar: [docs/DEVELOPER_PORTAL.md](docs/DEVELOPER_PORTAL.md)

## Sprint 1 (kimlik ve tenant temeli)

Ayrıntılar için: [docs/SPRINT1.md](docs/SPRINT1.md)

## Kurulum

```bash
cd modern-cms
pnpm install
```

## Geliştirme

Önce Postgres ve Redis’i ayağa kaldırın:

```bash
docker compose up -d postgres redis
cp .env.example .env
pnpm db:migrate
pnpm db:seed
```

Ardından:

```bash
pnpm dev
```

Bu komut API, admin ve worker süreçlerini birlikte başlatır. Sadece worker çalıştırmak için:

```bash
pnpm dev:worker
```

## Diğer komutlar

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm format
pnpm clean
pnpm db:migrate
pnpm db:seed
```

## Docker Compose (tüm servisler)

```bash
docker compose up --build
```

## Sağlık kontrolü

API ayaktayken:

```bash
curl -sS http://localhost:4000/health
```
