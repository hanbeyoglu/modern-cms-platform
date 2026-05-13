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
