# Sprint 12B — Public API Localization Integration

## Overview

Sprint 12B wires the localization foundation (Sprint 12A) into every public
delivery endpoint. All public content responses now accept a `?locale=` query
parameter and return translated field values where translations have been stored.
The fallback chain, cache key isolation, and N+1 protection are all handled
transparently.

---

## Public Locale Resolution

### How it works

`PublicContextService.resolve(tenantId, mallId, localeCode?)` extended to:

1. Call `TranslationResolverService.resolveLocale(tenantId, requestedCode)`.
2. If `requestedCode` is provided and matches an **active** locale → use it.
3. If `requestedCode` is absent, unknown, or inactive → fall back to the tenant's
   **default** locale.
4. If the tenant has no active locale configured at all → `locale: null` (all
   content served un-translated, base values only).

The resolved locale is available on `PublicContext`:
```typescript
interface PublicContext {
  tenantId: string;
  mallId: string | undefined;
  tenant: ...;
  mall: ...;
  locale: { id: string; code: string } | null;       // resolved locale
  defaultLocale: { id: string; code: string } | null; // tenant default
}
```

### Locale resolution — DB query cost

| Scenario | Queries |
|---|---|
| No locale requested, default is the only active locale | 1 (resolveLocale returns default) |
| Locale requested and it IS the default | 1 (resolveLocale returns default, isDefault=true) |
| Locale requested and it is NOT the default | 2 (resolveLocale + getDefaultLocale) |

---

## Cache Key Isolation

Every localized response is cached under a key that includes the resolved locale
code as a `:l:{code}` suffix. This ensures `?locale=tr` and `?locale=en` are
independent cache entries.

### Examples

```
public:{tenantId}:{mallId}:home:l:tr
public:{tenantId}:{mallId}:home:l:en
public:{tenantId}:{mallId}:sliders:all:l:tr
public:{tenantId}:{mallId}:sliders:mobile:l:en
public:{tenantId}:{mallId}:event:{slug}:l:tr
public:{tenantId}:{mallId}:campaign:{slug}:l:en
public:{tenantId}:{mallId}:page:{slug}:l:tr
public:{tenantId}:{mallId}:stores::::50:l:tr
public:{tenantId}:{mallId}:cinema:l:en
public:{tenantId}:{mallId}:movie-sessions::::50:l:tr
```

When no locale is configured → `:l:none`.

Redis unavailability is silently bypassed (same as before — never crashes the API).

---

## Translated Fields per Entity Type

| Entity | Translation entityType | Translated fields |
|--------|----------------------|-------------------|
| Slider | `SLIDER` | `title`, `subtitle`, `description`, `buttonText` |
| Event | `EVENT` | `title`, `shortDescription`, `description`, `buttonText` |
| Campaign | `CAMPAIGN` | `title`, `shortDescription`, `description`, `terms`, `buttonText` |
| Page | `PAGE` | `title`, `seoTitle`, `seoDescription` |
| PageBlock | `PAGE_BLOCK` | `title`; dataJson: `title`, `subtitle`, `buttonText`, `text`, `html` |
| Store (MallStore) | `STORE` | `name`, `description` |
| Movie | `MOVIE` | `title` (in movie-sessions; full title+description via future endpoint) |
| Cinema | `CINEMA` | `description` |

### PageBlock dataJson translation field naming

Translations for `dataJson` sub-fields use dot notation as the `field` value:

| Translation field | Applied to |
|---|---|
| `dataJson.title` | `block.dataJson.title` |
| `dataJson.subtitle` | `block.dataJson.subtitle` |
| `dataJson.buttonText` | `block.dataJson.buttonText` |
| `dataJson.text` | `block.dataJson.text` |
| `dataJson.html` | `block.dataJson.html` |

If `dataJson` is not a plain object (e.g. a string or array), the nested
translation step is skipped and only the top-level `title` is translated.

### Store entity ID

Translations for stores use the **MallStore ID** as `entityId` (the
tenant-scoped assignment), not the GlobalStore ID. Translating the `name`
field overrides the resolved display name (`localName ?? globalStore.name`).
Translating `description` overrides the resolved description
(`localDescription ?? globalStore.description`).

---

## N+1 Query Strategy

For every list endpoint, translations are batch-loaded in a **single query** per
entity type using `TranslationResolverService.getTranslationsForEntities`:

```
getTranslationsForEntities(tenantId, localeId, entityType, entityIds[])
  → single WHERE entityId IN (...) query
  → returns EntityTranslationMap: { [entityId]: { [field]: string } }
```

Applied in-memory after the Prisma query — no additional DB round-trips per item.

For **page + blocks**, two parallel queries are issued:
- `PAGE` translations for the single page ID
- `PAGE_BLOCK` translations for all block IDs on that page

For **movie sessions**, movie IDs are deduplicated before batch-fetching `MOVIE`
translations.

When `localeId` is absent (no locale configured) or the result set is empty,
the translation step is skipped entirely — zero extra queries.

---

## Response Metadata

### Home endpoint (`/public/home`)

The home endpoint returns a structured object and includes locale metadata:

```json
{
  "locale": "tr",
  "defaultLocale": "tr",
  "sliders": [...],
  "upcomingEvents": [...],
  "activeCampaigns": [...],
  "featuredStores": [...],
  "todayMovieSessions": [...]
}
```

### All other endpoints

Other endpoints return arrays or detail objects. Adding a metadata wrapper would
break existing clients. Locale metadata is **not** included in these response
bodies — the client knows which locale it requested. This is documented as a
known limitation.

---

## cURL Examples

### Setup

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@example.com","password":"SuperAdmin123!"}' \
  | jq -r '.accessToken')

TENANT=$(curl -s http://localhost:3000/tenants \
  -H "Authorization: Bearer $TOKEN" | jq -r '.tenants[0].id')
```

### Home in Turkish (default)

```bash
curl "http://localhost:3000/public/home?locale=tr" \
  -H "x-tenant-id: $TENANT"
```

### Home in English (non-default)

```bash
curl "http://localhost:3000/public/home?locale=en" \
  -H "x-tenant-id: $TENANT"
```

### Sliders — Turkish, desktop only

```bash
curl "http://localhost:3000/public/sliders?locale=tr&targetDevice=DESKTOP" \
  -H "x-tenant-id: $TENANT"
```

### Events — English

```bash
curl "http://localhost:3000/public/events?locale=en" \
  -H "x-tenant-id: $TENANT"
```

### Event detail — Turkish

```bash
curl "http://localhost:3000/public/events/summer-festival?locale=tr" \
  -H "x-tenant-id: $TENANT"
```

### Campaigns — English

```bash
curl "http://localhost:3000/public/campaigns?locale=en" \
  -H "x-tenant-id: $TENANT"
```

### Page with translated blocks

```bash
curl "http://localhost:3000/public/pages/about-us?locale=en" \
  -H "x-tenant-id: $TENANT"
```

### Stores (mall-scoped) — Turkish

```bash
curl "http://localhost:3000/public/stores?locale=tr" \
  -H "x-tenant-id: $TENANT" \
  -H "x-mall-id: $MALL"
```

### Cinema — English

```bash
curl "http://localhost:3000/public/cinema?locale=en" \
  -H "x-tenant-id: $TENANT" \
  -H "x-mall-id: $MALL"
```

### Movie sessions — Turkish

```bash
curl "http://localhost:3000/public/movie-sessions?locale=tr&date=2026-05-20" \
  -H "x-tenant-id: $TENANT" \
  -H "x-mall-id: $MALL"
```

### Add a translation to test (admin API)

```bash
# Translate a slider title to English
SLIDER_ID="<slider-cuid>"
curl -X POST http://localhost:3000/translations \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d "{
    \"localeCode\": \"en\",
    \"entityType\": \"SLIDER\",
    \"entityId\": \"$SLIDER_ID\",
    \"field\": \"title\",
    \"value\": \"Summer Sale 2026\"
  }"

# Verify it appears in the public response
curl "http://localhost:3000/public/sliders?locale=en" \
  -H "x-tenant-id: $TENANT"
```

---

## Fallback Behavior

| Condition | Behavior |
|---|---|
| `?locale=en` and `en` is active | Use `en` translations |
| `?locale=de` and `de` is unknown | Fall back to tenant default locale |
| `?locale=en` and `en` is inactive | Fall back to tenant default locale |
| No `?locale` parameter | Use tenant default locale |
| Tenant has no locale configured | Return base values, no translation applied |
| Translation missing for a field | Keep base field value unchanged |
| Redis down | Cache skipped, translations still applied from DB |

---

## Known Limitations

1. **Locale metadata only in `/public/home`.** All other endpoints return plain
   arrays or objects without a locale metadata wrapper to preserve backward
   compatibility. Future versions could wrap responses in
   `{ meta: { locale }, data: [...] }` with a versioned path prefix.

2. **PageBlock dataJson — top-level fields only.** Only `title`, `subtitle`,
   `buttonText`, `text`, and `html` at the top level of `dataJson` are
   translated. Deeply nested structures (e.g. FAQ `items[]` arrays) are not
   traversed. Deep JSON translation requires a schema-aware block type registry.

3. **Store `name` in search is not locale-aware.** The `?search=` parameter in
   `/public/stores` filters on the base `globalStore.name` / `description`
   columns. Searching within translated values requires a separate full-text
   translation index.

4. **Cinema `name` not translated.** Cinema display names are treated as
   canonical identifiers. Only `description` is translatable.

5. **No `Accept-Language` header support.** Locale selection uses the `?locale=`
   query parameter only. Browser `Accept-Language` negotiation is not wired; this
   is a frontend concern.

6. **No locale metadata on site-config.** The `/public/site-config` endpoint
   does not accept `?locale=` because it returns tenant/mall metadata rather than
   content.

---

## Admin Translation UI (Future Sprint)

Translation management (CRUD) is already available via the admin API
(`/translations`, `/locales`). An admin UI for adding and editing translations
per entity will be built in a future sprint. Until then, translations can be
managed directly through the API using the curl examples in `SPRINT12A.md`.
