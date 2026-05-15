# Sprint 24 — Public API Contract & Frontend Integration Readiness

## Overview

Sprint 24 standardizes the public API contract to cleanly support completely separate frontend projects. The CMS platform is a headless backend; frontend apps remain independent repositories with their own UI, routing, and design systems.

---

## Architecture Direction

This CMS is **NOT** a website/theme builder.

| CMS Responsibility | Frontend Responsibility |
|-------------------|------------------------|
| Content management | UI/UX and design system |
| Media management | Component library |
| Localization | Routing and navigation |
| Permissions & scheduling | Page rendering |
| Public API delivery | Analytics integration |

---

## Dynamic Static / Legal / Document Pages

Sprint 24 extends the existing Pages module for tenant-managed informational pages. This is intentionally **not** a generic custom fields system and not a frontend page builder.

### Supported page types

Pages now support these tenant-facing types:

- `ABOUT`
- `KVKK`
- `PRIVACY_POLICY`
- `COOKIE_POLICY`
- `TERMS_OF_USE`
- `CONTACT_INFO`
- `FAQ`
- `TRANSPORTATION`
- `CERTIFICATES`
- `DOCUMENTS`
- `AWARDS`
- `CUSTOM`

For `CUSTOM`, admins must provide `customTypeLabel`, e.g. `Diplomamız`, `Kalite Belgeleri`, or `Yetki Belgeleri`.

### Static document content model

`Page` now includes:

| Field | Purpose |
|---|---|
| `type` | One of the predefined static/legal/document page types |
| `customTypeLabel` | Display label for `CUSTOM` page types |
| `contentHtml` | Rich text/static HTML content managed by admin |

`PageAttachment` stores page document/media attachments:

| Field | Purpose |
|---|---|
| `title` | Attachment display title |
| `description` | Optional explanatory copy |
| `mediaId` | Linked media asset, primarily PDFs |
| `sortOrder` | Manual order |
| `downloadable` | Whether frontend should expose download behavior |

The admin UI provides page type selection, conditional custom label input, HTML content editing, and add/remove/reorder document attachments with a downloadable toggle.

### Public page response

`GET /public/pages/:slug` returns the existing page fields plus:

```json
{
  "title": "Kalite Belgeleri",
  "type": "CUSTOM",
  "customTypeLabel": "Kalite Belgeleri",
  "contentHtml": "<p>...</p>",
  "renderMode": "DOCUMENT_LIST",
  "attachments": [
    {
      "title": "ISO 9001",
      "description": "Kalite yönetim belgesi",
      "mediaId": "med_abc123",
      "sortOrder": 0,
      "downloadable": true,
      "media": {
        "id": "med_abc123",
        "url": "https://api.example.com/uploads/iso-9001.pdf",
        "mimeType": "application/pdf"
      }
    }
  ]
}
```

`renderMode` is `SINGLE_PDF` when there is exactly one PDF attachment, `DOCUMENT_LIST` when there are multiple/other attachments, and `HTML` when the page has no attachments.

---

## 1. Public Response Envelope

All public API responses are now wrapped in a standard envelope.

**Success:**
```json
{
  "success": true,
  "locale": "tr",
  "tenant": {
    "id": "ten_abc123",
    "mallId": "mal_xyz456"
  },
  "data": { ... }
}
```

**Error (unchanged — already compliant via HttpExceptionFilter):**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Event not found"
  }
}
```

**Paginated (future — interface defined, not yet used):**
```json
{
  "success": true,
  "locale": "tr",
  "tenant": { "id": "...", "mallId": "..." },
  "pagination": { "page": 1, "limit": 20, "total": 120, "totalPages": 6 },
  "data": [...]
}
```

### Implementation

- `apps/api/src/public/public-response.types.ts` — `PublicEnvelope<T>`, `PublicPaginatedEnvelope<T>`, `makeEnvelope()` helper
- `apps/api/src/public/public.controller.ts` — all 13 endpoint handlers now use `envelop(data, context)`

---

## 2. Media URL Standardization

Media fields now expose rich, consistent metadata. No internal storage implementation details are leaked.

**Before:**
```json
{ "url": "https://...", "altText": null }
```

**After (`PublicMediaAsset`):**
```json
{
  "id": "med_abc123",
  "url": "https://api.example.com/uploads/2024/banner.jpg",
  "width": 1920,
  "height": 1080,
  "alt": "Summer festival banner",
  "caption": "Photo by John Doe",
  "dominantColor": "#1a2e44"
}
```

### Fields sourced

The `MEDIA_SELECT` in `public-content.service.ts` now selects: `id`, `publicUrl`, `altText`, `caption`, `width`, `height`, `dominantColor`.

### CDN compatibility

The `url` field is the only field frontends should use for rendering. Future CDN proxy configuration will transparently update this field without any frontend changes required.

---

## 3. SEO Metadata Standardization

Every entity that can appear as a standalone page now includes a `seo` object.

```json
{
  "seo": {
    "title": "Summer Festival 2025",
    "description": "Join us for the biggest summer event of the year.",
    "keywords": ["festival", "event"],
    "image": "https://api.example.com/uploads/events/banner.jpg",
    "canonicalUrl": null,
    "locale": "tr"
  }
}
```

### Applied to

| Entity | SEO title source | SEO description source | SEO image source |
|--------|-----------------|----------------------|-----------------|
| Page | `seoTitle` ?? `title` | `seoDescription` | none |
| Event | `title` | `shortDescription` | `coverMedia.url` |
| Campaign | `title` | `shortDescription` | `coverMedia.url` |
| Store | resolved `name` | resolved `description` | `logo.url` |

`canonicalUrl` is always `null` from the API — the frontend computes it from slug + domain.

---

## 4. Locale & Tenant Context Standards

### Headers

| Header | Required | Notes |
|--------|----------|-------|
| `x-tenant-id` | Always | Tenant UUID |
| `x-mall-id` | Sometimes | Required for stores, cinema, movie-sessions; optional elsewhere |

### Query

| Param | Notes |
|-------|-------|
| `locale` | BCP 47 code (e.g. `tr`, `en`, `ar`). Falls back to tenant default if omitted or invalid. |

### Fallback chain

1. Requested locale → active locale match
2. Tenant default locale (if requested locale is invalid or inactive)
3. No locale context (if tenant has no active locales)

---

## 5. Search API Consistency

`GET /public/search?q=...` now returns structured hits that are self-contained for rendering.

**Before:**
```json
{
  "results": [
    { "id": "...", "title": "...", "entityType": "EVENT", "score": 0.9, "path": "/public/events/slug", "slug": "slug" }
  ]
}
```

**After:**
```json
{
  "results": [
    {
      "type": "event",
      "id": "evt_abc123",
      "slug": "summer-festival",
      "title": "Summer Festival",
      "description": "Join us for the biggest summer event.",
      "image": "https://api.example.com/uploads/events/banner.jpg",
      "url": "/public/events/summer-festival",
      "locale": "tr"
    }
  ]
}
```

### Changes

- `entityType` (uppercase Prisma enum) replaced by `type` (lowercase frontend-friendly string)
- `path` renamed to `url`
- `description` and `image` added via per-type DB enrichment queries
- `locale` added from request context

---

## 6. Public TypeScript SDK — `packages/public-sdk`

A new framework-agnostic package provides typed wrappers for all public endpoints.

```
packages/public-sdk/
├── package.json          @modern-cms/public-sdk
├── tsconfig.json
├── tsconfig.build.json
└── src/
    ├── index.ts          re-exports everything
    ├── types.ts          all CMS* TypeScript interfaces
    ├── client.ts         CmsPublicClient class
    ├── helpers.ts        locale, URL, pagination, date utilities
    └── analytics.ts      analytics event builders and adapters
```

### Key exports

```typescript
import {
  CmsPublicClient,   // main fetch client
  CmsApiError,       // typed error class
  isRtlLocale,       // locale direction helper
  resolveCanonicalUrl, // compute canonical URL on frontend
  parsePagination,   // pagination state helper
  unwrap,            // extract data or throw
  buildCmsEvent,     // analytics event builder
  campaignClickEvent, // pre-built event helpers
  searchEvent,
} from '@modern-cms/public-sdk';
```

---

## 7. Analytics Event Contract

Standard event payload:

```typescript
{
  type: 'campaign_click',   // CmsAnalyticsEventType
  entityId: 'cmp_abc123',   // entity being tracked
  slug: 'summer-sale',
  locale: 'tr',             // required
  tenantId: 'ten_abc123',   // required
  mallId: 'mal_xyz456',     // optional
  timestamp: '2025-01-01T12:00:00Z', // auto-set if omitted
  meta: { linkType: 'external' },    // optional extras
}
```

### Defined event types

| Type | Trigger |
|------|---------|
| `page_view` | CMS page rendered |
| `campaign_view` | Campaign card seen |
| `campaign_click` | Campaign CTA clicked |
| `event_view` | Event detail viewed |
| `store_view` | Store detail viewed |
| `search` | Search executed (includes query + result count) |
| `slider_click` | Slider CTA clicked |
| `movie_session_click` | Movie session ticket clicked |
| `cinema_view` | Cinema detail viewed |

The SDK provides an `AnalyticsAdapter` interface so any analytics provider (GA4, Segment, Mixpanel) can be plugged in.

---

## 8. API Versioning Strategy

### Current state

All public routes are at `/public/...` — this is effectively **v1**.

### Future evolution

- When breaking changes are needed, a new prefix `/public/v2/...` will be introduced
- `/public/` (v1) will continue working with a documented deprecation period
- No URL change for v1 consumers — only additive changes will be made to existing routes
- Clients can detect the API version from the `X-API-Version` response header (planned)

### What counts as breaking

- Removing or renaming fields in response types
- Changing field types
- Removing endpoints
- Changing error code semantics

### What is non-breaking (done freely)

- Adding new fields to existing response objects
- Adding new query parameters (optional)
- Adding new endpoints

---

## 9. Files Changed

### API (`apps/api/src/`)

| File | Change |
|------|--------|
| `public/public-response.types.ts` | Added `PublicMediaAsset`, `PublicSeoMeta`, `PublicEnvelope<T>`, `PublicPaginatedEnvelope<T>`, `makeEnvelope()` |
| `public/public-content.service.ts` | Rich `MEDIA_SELECT`, `toMediaAsset()`, SEO fields in all entity mappers |
| `public/public.controller.ts` | All 13 handlers wrapped with `envelop()` |
| `search/search.types.ts` | `PublicSearchHitDto` enhanced: `type`, `description`, `image`, `url`, `locale` |
| `search/search-result-mapper.service.ts` | `toPublicHit()` uses new fields + `ENTITY_TYPE_LABEL` mapping |
| `search/public-search.service.ts` | Added `localeCode` param + `enrichSearchHits()` method |

### New Package

| File | Purpose |
|------|---------|
| `packages/public-sdk/src/types.ts` | All `Cms*` TypeScript interfaces |
| `packages/public-sdk/src/client.ts` | `CmsPublicClient` + `CmsApiError` |
| `packages/public-sdk/src/helpers.ts` | Locale, URL, pagination, date utilities |
| `packages/public-sdk/src/analytics.ts` | Analytics event contract + adapters |
| `packages/public-sdk/src/index.ts` | Package entry point |

### Documentation

| File | Purpose |
|------|---------|
| `docs/FRONTEND_INTEGRATION.md` | Complete frontend developer guide |
| `docs/SPRINT24.md` | This file — sprint summary |

---

## 10. Assumptions

1. **No Prisma migration needed** — All fields used in the enhanced media select (`altText`, `caption`, `width`, `height`, `dominantColor`) already exist in the `MediaAsset` model from Sprint 23.

2. **Backward compatibility** — Existing public endpoint URLs are unchanged. The response structure changes (envelope added) are intentional API contract upgrades. Since no external frontend existed prior to this sprint, this is a safe migration.

3. **Search enrichment performance** — The `enrichSearchHits()` method adds up to 6 parallel DB queries per search call. This is acceptable given the Redis cache TTL of 45 seconds. For high-traffic scenarios, a denormalized `imageUrl`/`excerpt` column in `SearchIndexEntry` would be a future optimization.

4. **`canonicalUrl` is always null** — The API cannot know frontend URL structure. Frontends must compute canonical URLs from slug + domain.

5. **SDK publishing** — `packages/public-sdk` is `"private": true` and lives in the monorepo. To publish it to npm, remove `"private"` and set up a publish workflow.

6. **Analytics is foundation-only** — The SDK defines the event contract and provides adapters, but no server-side analytics ingestion endpoint is implemented yet. Frontends send events directly to their chosen analytics provider.
