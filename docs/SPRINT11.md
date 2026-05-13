# Sprint 11 — Public Content Delivery API & Cache Foundation

## Overview

Sprint 11 introduces a clean, unauthenticated public API layer that future websites, mobile apps, and kiosk apps can consume. Admin users create and publish content; public clients fetch it via `/public/*` endpoints with no JWT required.

---

## Architecture

```
Public Client (web / mobile / kiosk)
        │
        │  x-tenant-id header (required)
        │  x-mall-id header   (optional)
        ▼
  PublicController  (/public/*)
        │
        ├─▶ PublicContextService   ← validates tenant/mall, no JWT
        ├─▶ PublicCacheService     ← Redis read-through (safe fallback)
        └─▶ PublicContentService   ← Prisma queries, public-only fields
```

### Key boundaries

| Layer | Responsibility |
|---|---|
| `PublicContextService` | Resolve + validate tenant/mall from headers |
| `PublicCacheService` | Redis get/set/invalidate with safe fallback |
| `PublicContentService` | All public Prisma queries + response mapping |
| `PublicController` | HTTP routing, cache orchestration, error responses |

---

## Context Resolution

Every public request must include `x-tenant-id`. `x-mall-id` is optional but required for mall-scoped endpoints (stores, cinema, movie-sessions).

### Validation rules

1. `x-tenant-id` must be present and non-empty → `400` otherwise
2. Tenant must exist and have status `ACTIVE` → `404` / `400`
3. If `x-mall-id` provided, mall must belong to that tenant and have status `LIVE` → `404` / `400`
4. Returns `{ tenantId, mallId, tenant, mall }` context object

### Future: domain/subdomain resolution

Add a `DomainResolutionService` that:
1. Looks up the incoming `Host` header in a `TenantDomain` table (to be added to schema)
2. Resolves `tenantId` + optional `mallId` without requiring headers
3. Falls back to header-based resolution for API clients / local dev

Suggested schema addition:
```prisma
model TenantDomain {
  id       String  @id @default(cuid())
  domain   String  @unique  // "mall.example.com"
  tenantId String
  mallId   String?
  isPrimary Boolean @default(false)
}
```

---

## Endpoint Reference

All endpoints are under `/public`. No authentication required. All require `x-tenant-id` header.

| Method | Path | Mall Required | Cache TTL | Description |
|---|---|---|---|---|
| GET | `/public/site-config` | No | 300s | Tenant/mall identity |
| GET | `/public/home` | No | 120s | Aggregated home page data |
| GET | `/public/sliders` | No | 120s | Published sliders |
| GET | `/public/events` | No | 120s | Published upcoming events |
| GET | `/public/events/:slug` | No | 300s | Single event by slug |
| GET | `/public/campaigns` | No | 120s | Active campaigns |
| GET | `/public/campaigns/:slug` | No | 300s | Single campaign by slug |
| GET | `/public/stores` | **Yes** | 120s | Active mall stores |
| GET | `/public/stores/:slug` | **Yes** | 300s | Single store by global slug |
| GET | `/public/pages/:slug` | No | 300s | Published CMS page + blocks |
| GET | `/public/cinema` | **Yes** | 120s | Active cinemas in mall |
| GET | `/public/movie-sessions` | **Yes** | 120s | Scheduled sessions |

### Query Parameters

```
GET /public/sliders?targetDevice=MOBILE|DESKTOP|ALL

GET /public/events?category=kids&search=summer&limit=6

GET /public/campaigns?storeId=<id>&search=&limit=6

GET /public/stores?categoryId=<id>&search=zara&featuredOnly=true&limit=50

GET /public/movie-sessions?date=2026-05-14&cinemaId=<id>&movieId=<id>&limit=50
```

---

## Published Content Rules

### Sliders
- `status = PUBLISHED`
- `deletedAt IS NULL`
- `startAt <= now OR startAt IS NULL`
- `endAt >= now OR endAt IS NULL`
- Optional `targetDevice` filter

### Events
- `status = PUBLISHED`, `deletedAt IS NULL`
- `endAt >= now OR endAt IS NULL` (upcoming / ongoing)
- Mall scope: returns events where `mallId = x-mall-id OR mallId IS NULL`

### Campaigns
- `status = PUBLISHED`, `deletedAt IS NULL`
- Active window: `startAt <= now` AND `endAt >= now` (nulls = evergreen)
- Mall scope same as events

### Stores
- `MallStore.status = ACTIVE`, `deletedAt IS NULL`
- `GlobalStore.status = ACTIVE`, `deletedAt IS NULL`
- Requires `x-mall-id`; optional `featuredOnly`, `categoryId`, `search`

### Pages
- `status = PUBLISHED`, `deletedAt IS NULL`
- Blocks: `status = ACTIVE`, `deletedAt IS NULL`, ordered by `sortOrder`
- Mall scope same as events

### Cinema
- `Cinema.status = ACTIVE`, `deletedAt IS NULL`
- Requires `x-mall-id`

### Movie Sessions
- `MovieSession.status = SCHEDULED`, `deletedAt IS NULL`
- `Cinema.status = ACTIVE`, `Movie.status = ACTIVE`
- Optional date filter (UTC day boundary), cinemaId, movieId
- Requires `x-mall-id`

---

## Response Shape Examples

### `GET /public/site-config`
```json
{
  "tenantId": "clxxxx",
  "tenantName": "Acme Mall Group",
  "tenantSlug": "acme-mall",
  "mallId": "clzzzz",
  "mallName": "Downtown Plaza",
  "mallSlug": "downtown-plaza"
}
```

### `GET /public/sliders`
```json
[
  {
    "id": "cl...",
    "title": "Summer Sale",
    "subtitle": "Up to 50% off",
    "description": null,
    "desktopMedia": { "url": "https://cdn.../banner.jpg", "altText": "summer-banner.jpg" },
    "mobileMedia": { "url": "https://cdn.../banner-mobile.jpg", "altText": "banner-mobile.jpg" },
    "videoMedia": null,
    "linkType": "EXTERNAL_URL",
    "linkValue": "https://example.com/sale",
    "buttonText": "Shop Now",
    "targetDevice": "ALL",
    "sortOrder": 1,
    "startAt": "2026-06-01T00:00:00.000Z",
    "endAt": "2026-08-31T23:59:59.000Z"
  }
]
```

### `GET /public/events/:slug`
```json
{
  "id": "cl...",
  "slug": "summer-kids-festival",
  "title": "Summer Kids Festival",
  "shortDescription": "Fun for all ages",
  "description": "<p>...</p>",
  "coverMedia": { "url": "https://cdn.../cover.jpg", "altText": "festival-cover.jpg" },
  "startAt": "2026-07-01T10:00:00.000Z",
  "endAt": "2026-07-03T20:00:00.000Z",
  "location": "Level 2 Atrium",
  "category": "kids",
  "buttonText": "Learn More",
  "linkUrl": null,
  "sortOrder": 0,
  "publishedAt": "2026-05-14T09:00:00.000Z"
}
```

### `GET /public/stores?featuredOnly=true`
```json
[
  {
    "id": "cl...",
    "mallId": "cl...",
    "name": "Zara",
    "description": "Fashion for all",
    "floor": "Level 1",
    "storeNo": "101",
    "phone": "+90 212 000 0000",
    "email": null,
    "workingHoursJson": { "mon": "10:00-22:00" },
    "locationJson": { "lat": 41.0, "lng": 29.0 },
    "isFeatured": true,
    "sortOrder": 1,
    "logo": { "url": "https://cdn.../zara-logo.png" },
    "globalStore": { "id": "cl...", "name": "Zara", "slug": "zara", "websiteUrl": "https://zara.com" },
    "category": { "id": "cl...", "name": "Fashion", "slug": "fashion" }
  }
]
```

### `GET /public/pages/:slug`
```json
{
  "id": "cl...",
  "slug": "about-us",
  "title": "About Us",
  "type": "STANDARD",
  "seoTitle": "About Downtown Plaza",
  "seoDescription": "Learn about our mall",
  "seoKeywords": "mall, shopping, downtown",
  "publishedAt": "2026-05-10T12:00:00.000Z",
  "blocks": [
    {
      "id": "cl...",
      "type": "HERO",
      "title": "Welcome",
      "dataJson": { "heading": "Welcome to Downtown Plaza", "subheading": "..." },
      "sortOrder": 0
    }
  ]
}
```

### `GET /public/home`
```json
{
  "sliders": [...],
  "featuredStores": [...],
  "upcomingEvents": [...],
  "activeCampaigns": [...],
  "todayMovieSessions": [...]
}
```

Home limits: sliders=10, featuredStores=12, events=6, campaigns=6, movieSessions=10.  
`featuredStores` and `todayMovieSessions` are empty arrays when no `x-mall-id` is provided.

---

## Cache Strategy

### Implementation

`PublicCacheService` wraps `ioredis` with:
- **Safe fallback**: if Redis is unavailable, all cache methods return null/void silently
- **Auto-reconnect**: ioredis retries with exponential backoff (500ms → 10s)
- **No offline queue**: operations fail immediately if disconnected (no request queuing)
- **TTL-based expiry**: all keys have explicit TTL via Redis `SET ... EX`

### Cache Key Pattern

```
public:{tenantId}:{mallId|none}:{endpoint}[:{params}]
```

Examples:
```
public:clt001:none:site-config
public:clt001:clm001:home
public:clt001:clm001:sliders:MOBILE
public:clt001:none:events:::20
public:clt001:clm001:event:summer-festival
public:clt001:clm001:stores:::false:50
public:clt001:clm001:movie-sessions:2026-05-14:::50
```

### TTL Reference

| Endpoint | TTL |
|---|---|
| `/public/site-config` | 300s (5 min) |
| `/public/home` | 120s (2 min) |
| List endpoints | 120s (2 min) |
| Detail endpoints (`:slug`) | 300s (5 min) |

---

## Cache Invalidation Plan

### Available helpers (implemented)

```typescript
// Invalidate all public cache for a tenant
await publicCacheService.invalidateTenant(tenantId);

// Invalidate all public cache for a specific mall
await publicCacheService.invalidateMall(tenantId, mallId);

// Invalidate a specific key or pattern
await publicCacheService.invalidatePublicKey('public:clt001:*:sliders:*');
```

### Recommended wiring (future)

When admin mutations publish, archive, or update content, inject `PublicCacheService` and call the appropriate invalidation:

| Admin action | Invalidation call |
|---|---|
| Slider publish/archive/update | `invalidateMall(tenantId, mallId)` or targeted slider key |
| Event publish/archive/update | `invalidateTenant(tenantId)` (events can be tenant-wide) |
| Campaign publish/archive/update | `invalidateTenant(tenantId)` |
| Page publish/archive/update | `invalidateTenant(tenantId)` |
| MallStore update | `invalidateMall(tenantId, mallId)` |
| Cinema update | `invalidateMall(tenantId, mallId)` |

`PublicModule` exports `PublicCacheService`, so admin modules can import `PublicModule` and inject it.

> **Note**: The `KEYS` command is used for pattern invalidation. This is appropriate for the current cache cardinality (low key count per tenant). If key counts grow significantly, replace with `SCAN`-based iteration.

---

## Security

Public endpoints are unauthenticated but hardened:

| Concern | Mitigation |
|---|---|
| Tenant/mall spoofing | Validated against DB on every request (cached after validation) |
| Admin field leakage | `createdBy`, `updatedBy`, `deletedAt`, `providerConfigJson` never included |
| Provider config exposure | `Cinema.providerConfigJson` explicitly excluded from all public queries |
| Oversized responses | All list endpoints have configurable `limit` with enforced max |
| Stack trace leakage | NestJS global exception filter returns structured `4xx`/`5xx` with no raw stack |
| Inactive tenant abuse | Returns `400` for SUSPENDED/PENDING/ARCHIVED tenants |
| Closed mall abuse | Returns `400` for DRAFT/MAINTENANCE/CLOSED malls |

---

## Analytics Tracking Note

Public endpoints do **not** auto-track reads in Sprint 11. The `AnalyticsEvent` model and `/analytics/track` endpoint are available for client-side tracking.

Public clients (web/mobile/kiosk) should POST to `/analytics/track` with:

```json
{
  "entityType": "EVENT",
  "entityId": "cl...",
  "action": "VIEW",
  "path": "/events/summer-festival",
  "metadata": { "source": "home-banner" }
}
```

All public responses include `id`, `slug`, and `entityType`-compatible fields for tracking.

---

## Known Limitations

1. **No `/public/movies` endpoint**: Movie data is embedded in `/public/movie-sessions` responses (title, slug, duration). A standalone movie browser endpoint can be added in a future sprint.

2. **No pagination on public lists**: Public endpoints use `limit` with a max cap. Cursor-based pagination can be added if needed for large catalogs.

3. **KEYS for pattern invalidation**: Uses Redis `KEYS` command. Must migrate to `SCAN` if key cardinality becomes high (>10k keys per tenant).

4. **No rate limiting**: Public endpoints have no rate limiting yet. Add `@nestjs/throttler` before production traffic exposure.

5. **Cache warm-up**: No cache pre-warming. First request after deploy or TTL expiry hits the database directly.

6. **Domain resolution**: Not yet implemented. Clients must send `x-tenant-id`/`x-mall-id` headers.

7. **Store slug lookup**: Store detail (`/public/stores/:slug`) uses `GlobalStore.slug`, not a local `MallStore` slug. This is intentional — global slug is canonical.

---

## curl Examples

```bash
# Site config
curl -H "x-tenant-id: clt001" -H "x-mall-id: clm001" \
  http://localhost:3000/public/site-config

# Home aggregation (with mall)
curl -H "x-tenant-id: clt001" -H "x-mall-id: clm001" \
  http://localhost:3000/public/home

# Sliders for mobile
curl -H "x-tenant-id: clt001" -H "x-mall-id: clm001" \
  "http://localhost:3000/public/sliders?targetDevice=MOBILE"

# Upcoming kids events
curl -H "x-tenant-id: clt001" \
  "http://localhost:3000/public/events?category=kids&limit=6"

# Event by slug
curl -H "x-tenant-id: clt001" \
  http://localhost:3000/public/events/summer-kids-festival

# Active campaigns for a store
curl -H "x-tenant-id: clt001" -H "x-mall-id: clm001" \
  "http://localhost:3000/public/campaigns?storeId=clstore001"

# Campaign by slug
curl -H "x-tenant-id: clt001" -H "x-mall-id: clm001" \
  http://localhost:3000/public/campaigns/summer-sale

# Featured stores
curl -H "x-tenant-id: clt001" -H "x-mall-id: clm001" \
  "http://localhost:3000/public/stores?featuredOnly=true"

# Store by slug
curl -H "x-tenant-id: clt001" -H "x-mall-id: clm001" \
  http://localhost:3000/public/stores/zara

# CMS page
curl -H "x-tenant-id: clt001" \
  http://localhost:3000/public/pages/about-us

# Active cinemas
curl -H "x-tenant-id: clt001" -H "x-mall-id: clm001" \
  http://localhost:3000/public/cinema

# Movie sessions for today
curl -H "x-tenant-id: clt001" -H "x-mall-id: clm001" \
  "http://localhost:3000/public/movie-sessions?date=2026-05-14"

# Sessions for a specific cinema and date
curl -H "x-tenant-id: clt001" -H "x-mall-id: clm001" \
  "http://localhost:3000/public/movie-sessions?date=2026-05-14&cinemaId=clcinema001"
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |

---

## Changed Files Summary

### New files
- `apps/api/src/public/public.module.ts`
- `apps/api/src/public/public.controller.ts`
- `apps/api/src/public/public-context.service.ts`
- `apps/api/src/public/public-content.service.ts`
- `apps/api/src/public/public-response.types.ts`
- `apps/api/src/public/cache/public-cache.service.ts`
- `docs/SPRINT11.md`

### Modified files
- `apps/api/src/app.module.ts` — registered `PublicModule`
- `apps/api/package.json` — added `ioredis ^5.x`
