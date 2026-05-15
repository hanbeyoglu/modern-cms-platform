# Frontend Integration Guide

This guide is for frontend developers building applications on top of the Modern CMS Platform public API.

---

## Architecture Philosophy

The CMS is a **headless content backend**. Frontend projects are fully independent:

- Their own repository, tech stack, routing, and design system
- They fetch content from the public API and render it however they like
- The CMS is responsible for: content, media, localization, scheduling, analytics events
- The CMS is NOT responsible for: UI, navigation, page templates, theming

### Separation of concerns

```
CMS Platform (this repo)          Your Frontend App
─────────────────────────         ─────────────────────────────
Content management         →      Fetches data from /public/*
Media storage & metadata   →      Renders with your components
Localization (i18n)        →      Chooses locale, renders RTL/LTR
Scheduling & publish rules →      Gets clean, always-published data
Public API delivery        →      Calls typed endpoints
```

---

## API Base URL

All public endpoints live under `/public/`:

```
https://your-api.example.com/public/site-config
https://your-api.example.com/public/home
https://your-api.example.com/public/events
https://your-api.example.com/public/campaigns
https://your-api.example.com/public/stores
https://your-api.example.com/public/pages/:slug
https://your-api.example.com/public/cinema
https://your-api.example.com/public/movie-sessions
https://your-api.example.com/public/search
```

---

## Required Headers

| Header | Required | Description |
|--------|----------|-------------|
| `x-tenant-id` | **Always required** | Identifies which tenant's content to serve |
| `x-mall-id` | Required for some endpoints | Scopes content to a specific mall/location |

Endpoints requiring `x-mall-id`: `/public/stores`, `/public/cinema`, `/public/movie-sessions`.
Other endpoints (`/public/events`, `/public/campaigns`, etc.) support `x-mall-id` optionally to scope results to a location.

---

## Locale Handling

### Query parameter

Pass `?locale=tr` (or any active locale code) to get translated content:

```
GET /public/events?locale=tr
GET /public/pages/about?locale=en
```

### Fallback behavior

| Scenario | Behavior |
|----------|----------|
| `locale` omitted | Uses tenant default locale |
| `locale` is invalid or not active | Falls back to tenant default locale |
| `locale` is active but has no translations | Returns base content (untranslated fields remain in the default locale) |
| Tenant has no active locales | Content is returned without locale context |

### Available locales

Fetch the supported locales from `GET /public/site-config`. The response includes:

```json
{
  "supportedLocales": [
    { "code": "tr", "name": "Türkçe", "rtl": false },
    { "code": "en", "name": "English", "rtl": false },
    { "code": "ar", "name": "العربية", "rtl": true }
  ],
  "defaultLocale": "tr",
  "activeLocale": "tr",
  "rtl": false
}
```

### RTL support

- Check `siteConfig.rtl` or the resolved locale's `rtl` flag
- Apply `dir="rtl"` on your root element when RTL is active
- The SDK helper `isRtlLocale(code)` can also be used client-side

---

## Response Envelope

All public API responses are wrapped in a standard envelope:

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

Error responses follow:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Event not found"
  }
}
```

### Error codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `BAD_REQUEST` | 400 | Missing required header or invalid parameter |
| `NOT_FOUND` | 404 | Entity not found or not published |
| `UNAUTHORIZED` | 401 | Auth required (admin endpoints only) |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

---

## Media

Every media field in a public response follows this shape:

```json
{
  "id": "med_abc123",
  "url": "https://api.example.com/uploads/2024/image.jpg",
  "width": 1920,
  "height": 1080,
  "alt": "Summer festival banner",
  "caption": "Event banner photo",
  "dominantColor": "#1a2e44"
}
```

### Rendering guidance

- Use `alt` for `<img alt="...">` — never hardcode alt text
- Use `width` / `height` to set `aspect-ratio` or native image dimensions (avoids CLS)
- Use `dominantColor` as a placeholder color while the image loads
- `url` is an absolute URL pointing to the API's storage endpoint

### CDN readiness

The `url` field is returned from the API's storage backend. In production, you can configure a CDN prefix via the `API_BASE_URL` env var. Frontends should treat `url` as opaque and always use it as-is.

### Responsive images

The API does not yet serve resized variants. For responsive images:
- Use CSS `object-fit: cover` with a fixed aspect ratio container
- Use `width`/`height` from the media object for intrinsic sizing
- Future: the variant system (Sprint 23 scaffold) will provide pre-generated sizes

---

## SEO Metadata

Every entity that supports SEO (pages, events, campaigns, stores) includes a `seo` object:

```json
{
  "seo": {
    "title": "Summer Festival 2025",
    "description": "Join us for the biggest summer event of the year.",
    "keywords": ["festival", "summer", "event"],
    "image": "https://api.example.com/uploads/events/summer-banner.jpg",
    "canonicalUrl": null,
    "locale": "tr"
  }
}
```

`canonicalUrl` is always `null` from the API — compute it on the frontend:

```typescript
// Next.js example
export async function generateMetadata({ params }) {
  const res = await cms.getEvent(params.slug);
  const event = res.data;

  return {
    title: event.seo.title,
    description: event.seo.description,
    keywords: event.seo.keywords?.join(', '),
    openGraph: {
      images: event.seo.image ? [event.seo.image] : [],
    },
    alternates: {
      canonical: `https://yoursite.com/events/${event.slug}`,
    },
  };
}
```

---

## Using the Public SDK

Install the SDK from within the monorepo (or publish it to npm):

```typescript
import { CmsPublicClient } from '@modern-cms/public-sdk';

const cms = new CmsPublicClient({
  baseUrl: 'https://api.example.com',
  tenantId: process.env.CMS_TENANT_ID!,
  mallId: process.env.CMS_MALL_ID,
  defaultLocale: 'tr',
});

// Fetch the home page (sliders, events, campaigns, stores)
const home = await cms.getHomePage();
console.log(home.data.sliders);

// Fetch events with locale override
const events = await cms.getEvents({ locale: 'en', limit: 10 });

// Fetch a single event
const event = await cms.getEvent('summer-festival');
```

---

## Next.js Integration

### App Router (recommended)

```typescript
// app/events/page.tsx
import { CmsPublicClient } from '@modern-cms/public-sdk';

const cms = new CmsPublicClient({
  baseUrl: process.env.CMS_API_URL!,
  tenantId: process.env.CMS_TENANT_ID!,
  mallId: process.env.CMS_MALL_ID,
  defaultLocale: 'tr',
});

export default async function EventsPage() {
  const res = await cms.getEvents({ limit: 20 });
  const events = res.data;

  return (
    <ul>
      {events.map((e) => (
        <li key={e.id}>
          <a href={`/events/${e.slug}`}>{e.title}</a>
        </li>
      ))}
    </ul>
  );
}

// ISR: revalidate every 2 minutes
export const revalidate = 120;
```

### Static generation with ISR

```typescript
// app/events/[slug]/page.tsx
export async function generateStaticParams() {
  const res = await cms.getEvents({ limit: 100 });
  return res.data.map((e) => ({ slug: e.slug }));
}

export default async function EventDetailPage({ params }) {
  const res = await cms.getEvent(params.slug);
  return <EventDetail event={res.data} />;
}

export const revalidate = 300; // 5 minutes
```

### Caching suggestions

| Content type | Suggested revalidation |
|--------------|----------------------|
| Site config | 5–10 minutes |
| Home page | 1–2 minutes |
| Event/campaign list | 1–2 minutes |
| Event/campaign detail | 3–5 minutes |
| Page (static) | 5–10 minutes |
| Search results | 30–60 seconds |

---

## React Usage

```tsx
// hooks/useCmsEvents.ts
import { useEffect, useState } from 'react';
import { CmsPublicClient, type CmsEvent } from '@modern-cms/public-sdk';

const cms = new CmsPublicClient({ ... });

export function useCmsEvents(locale: string) {
  const [events, setEvents] = useState<CmsEvent[]>([]);

  useEffect(() => {
    cms.getEvents({ locale }).then((res) => setEvents(res.data));
  }, [locale]);

  return events;
}
```

---

## Vue / Nuxt Usage

```typescript
// composables/useCmsEvents.ts
import { ref, watchEffect } from 'vue';
import { CmsPublicClient, type CmsEvent } from '@modern-cms/public-sdk';

const cms = new CmsPublicClient({ ... });

export function useCmsEvents(locale: Ref<string>) {
  const events = ref<CmsEvent[]>([]);

  watchEffect(async () => {
    const res = await cms.getEvents({ locale: locale.value });
    events.value = res.data;
  });

  return { events };
}
```

---

## Mobile (React Native / Swift / Kotlin)

For mobile apps that cannot use the TypeScript SDK directly, call the REST API directly:

```
GET /public/events?locale=tr
Headers:
  x-tenant-id: ten_abc123
  x-mall-id: mal_xyz456
```

The response envelope (`success`, `locale`, `tenant`, `data`) is consistent for all platforms.

---

## Tenant-Aware Frontend Strategy

If you serve multiple tenants with a single frontend:

1. Store `tenantId` and `mallId` in environment variables or route parameters
2. Initialize `CmsPublicClient` per-request (SSR) or once at app init (SPA)
3. The `getSiteConfig` endpoint tells you everything about the current tenant/mall context
4. Use `siteConfig.supportedLocales` to build language switchers

---

## Analytics

Track user interactions using the SDK's analytics utilities:

```typescript
import {
  campaignClickEvent,
  searchEvent,
  buildCmsEvent,
  consoleAnalyticsAdapter,
} from '@modern-cms/public-sdk';

// Replace with your actual analytics adapter (GA4, Segment, Mixpanel)
const analytics = consoleAnalyticsAdapter;

// Track a campaign click
analytics.track(campaignClickEvent({
  entityId: campaign.id,
  slug: campaign.slug,
  locale: 'tr',
  tenantId: 'ten_abc123',
  mallId: 'mal_xyz456',
}));

// Track a search
analytics.track(searchEvent({
  query: 'summer',
  resultCount: results.length,
  locale: 'tr',
  tenantId: 'ten_abc123',
}));

// Custom event
analytics.track(buildCmsEvent({
  type: 'slider_click',
  entityId: slider.id,
  locale: 'tr',
  tenantId: 'ten_abc123',
  mallId: 'mal_xyz456',
  meta: { linkType: slider.linkType },
}));
```

### Analytics event reference

| Event | Trigger |
|-------|---------|
| `page_view` | User views a CMS page |
| `campaign_view` | User sees a campaign card |
| `campaign_click` | User clicks CTA on a campaign |
| `event_view` | User views an event detail |
| `store_view` | User views a store detail |
| `search` | User performs a search |
| `slider_click` | User clicks a slider CTA |
| `movie_session_click` | User clicks a movie session ticket link |
| `cinema_view` | User views cinema details |

---

## API Versioning

The current API is effectively **v1**. The base path `/public/` is stable.

### Future versioning strategy

When breaking changes are needed:
- A new route prefix `/public/v2/` will be introduced
- `/public/` (v1) will remain functional with a deprecation period
- Version is communicated via the `X-API-Version` response header
- The SDK's major version will align with the API version

**Current version:** v1 (no explicit version in URL — stable contract)

---

## CORS

The API supports `CORS_ORIGINS` configuration. For development with `localhost`, CORS is open by default.

For production, add your frontend domain(s) to the `CORS_ORIGINS` environment variable:
```
CORS_ORIGINS=https://yoursite.com,https://yoursite-staging.com
```

---

## Summary Checklist

- [ ] Set `x-tenant-id` header on every request
- [ ] Set `x-mall-id` for stores, cinema, movie-sessions endpoints
- [ ] Pass `?locale=` query param for localized content
- [ ] Call `getSiteConfig` at app start to get supported locales and mall metadata
- [ ] Use `seo` object from each entity for `<head>` metadata
- [ ] Compute `canonicalUrl` on the frontend from slug + base URL
- [ ] Set `img alt` from `media.alt`
- [ ] Implement ISR/revalidation for server-rendered pages
- [ ] Instrument analytics events for key interactions
