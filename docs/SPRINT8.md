# Sprint 8 — Sinema ve seans motoru

## Mimari özeti

- **Cinema**: `tenantId` + `mallId` ile AVM kapsamlıdır. Slug **AVM içinde** benzersizdir (`@@unique([mallId, slug])`). Logo isteğe bağlı `MediaAsset` referansıdır. `providerType` (`MANUAL` | `API` | `XML_FEED`) ve isteğe bağlı `providerConfigJson` ile ileride harici senkron için hazırlık yapılır; şu an yalnızca manuel CRUD kullanılır.
- **Movie**: **Tenant** kapsamlıdır; aynı tenant altındaki tüm AVM’lerdeki seanslarda yeniden kullanılabilir. Slug tenant içinde benzersizdir.
- **MovieSession**: `tenantId` + `mallId` + `cinemaId` + `movieId` ile seans kaydıdır. Sinema aynı tenant ve AVM’ye ait olmalı; film aynı tenant’a ait olmalı. `startsAt` zorunludur; `endsAt` isteğe bağlı ve varsa başlangıçtan sonra olmalıdır.

## Manuel sağlayıcı stratejisi

Varsayılan `CinemaProviderType.MANUAL`: tüm sinema, film ve seans verisi admin arayüzü veya API üzerinden girilir. Otomatik dış kaynak çekimi veya gerçek üçüncü parti API entegrasyonu **bu sprintte yoktur**.

## Gelecek API / XML hazırlığı

- `providerType` ve `providerConfigJson` (ör. `{ "baseUrl": "...", "apiKeyRef": "..." }`) alanları, ileride worker/cron ile doldurulacak senkron işleri için veri taşıyıcı olarak bırakılmıştır.
- Public okuma metotları (`getPublicCinemas`, `getPublicMovies`, `getPublicMovieSessions`) yalnızca **aktif / planlı / silinmemiş** kayıtları döner; ön yüz entegrasyonunda doğrudan kullanılabilir.

## İzinler (RBAC)

| Kod | Açıklama |
|-----|----------|
| `cinema:read` … `cinema:delete` | Sinema CRUD |
| `movie:read` … `movie:delete` | Film CRUD |
| `movie-session:read` … `movie-session:delete` | Seans CRUD |
| `movie-session:cancel` | Seans iptali (`CANCELLED`) |

**Seed özeti**: `SUPER_ADMIN` / `TENANT_ADMIN` tüm izinler. `MALL_MANAGER` sinema + seans tam yetki; film **read/create/update** (delete yok). `CONTENT_EDITOR` sinema/film/seans için read/create/update (delete ve cancel yok). `REPORT_VIEWER` yalnızca read.

## API uçları

| Metot | Yol | Bağlam |
|--------|-----|--------|
| GET/POST | `/cinemas`, `/cinemas/:id` | `x-tenant-id`, `x-mall-id` |
| PATCH/DELETE | `/cinemas/:id` | Aynı |
| GET/POST | `/movies`, `/movies/:id` | `x-tenant-id` (mall şart değil) |
| PATCH/DELETE | `/movies/:id` | Aynı |
| GET/POST | `/movie-sessions` | `x-tenant-id`, `x-mall-id` |
| GET/PATCH/DELETE | `/movie-sessions/:id` | Aynı |
| POST | `/movie-sessions/:id/cancel` | `movie-session:cancel` |

Listelerde: sayfalama (`page`, `limit`), `search`, `status`; seans listesinde `cinemaId`, `movieId`, `startsFrom`, `startsTo`.

## Admin kullanımı

1. Tenant + AVM seçin.
2. **Filmler** (`/movies`): tenant genelinde film oluşturun (AFM seçimi gerekmez).
3. **Sinemalar** (`/cinemas`): seçili AVM için sinema oluşturun; logo için medya seçin.
4. **Seanslar** (`/movie-sessions`): sinema + film + tarih/saat; gerekirse bilet URL’si.

## Audit

`AuditLogService` ile şu aksiyonlar yazılır: `cinema:create|update|delete`, `movie:create|update|delete`, `movie-session:create|update|delete|cancel`. Uygun yerlerde `before` / `after` özetleri eklenir.

## Bilinen sınırlamalar

- Harici API/XML senkronu yok; `providerConfigJson` şema doğrulaması serviste temel nesne kontrolü ile sınırlıdır.
- `getPublicMovies` içinde `date` verildiğinde gün aralığı **UTC** tabanlıdır; üretimde TZ ihtiyacına göre netleştirilmelidir.
- Film silindiğinde bağlı seanslar DB kısıtı ile bloklanır (`Movie` → `MovieSession` `Restrict`); önce seansların kaldırılması veya yumuşak silme stratejisi operasyonel olarak yönetilmelidir.
