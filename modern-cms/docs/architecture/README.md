# Mimari

## Genel

Monorepo, **pnpm workspace** ve **Turborepo** ile yönetilir.

## API ve gelecekteki tüketiciler

- **Admin** ve ileride eklenecek **kamu web siteleri** aynı CMS API’sini kullanabilir.
- Sınır ayrımı önerisi:
  - Yönetim uçları: kimlik doğrulama, içerik yayınlama, yapılandırma.
  - Kamu uçları: salt okunur içerik, önbellekleme, oran sınırlama ve ayrı CORS politikaları.
- `CORS_ORIGINS` ile izinli kökenler konfigüre edilir.

## Veri katmanı

- **PostgreSQL** kalıcı veri için.
- **Redis** kuyruk/önbellek ve işçi süreçleri için ayrılmıştır (iş mantığı henüz minimal).

## ORM

- **Prisma** şema ve migrasyonlar `apps/api/prisma` altında tutulur.
