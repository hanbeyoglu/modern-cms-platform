# Developer Portal

Auto-generated, **multilingual** API documentation for frontend developers building Web, Mobile, React Native, Flutter, Kiosk, and Digital Signage applications.

## URLs

| URL                         | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `/developer`                | **Scalar Developer Portal** — public API only, recipes, search     |
| `/api/docs`                 | **Swagger UI** — **complete** backend API (admin + public)           |
| `/openapi.json`             | Full OpenAPI 3.1 — Turkish (default)                                 |
| `/openapi.developer.json`   | Frontend portal OpenAPI — **public `/public/*` only**                |
| `/openapi.en.json`          | Full OpenAPI — English                                               |
| `/openapi.developer.en.json`| Frontend portal OpenAPI — English                                    |
| `/openapi.ru.json`          | Full OpenAPI — Russian                                               |
| `/openapi.developer.ru.json`| Frontend portal OpenAPI — Russian                                    |

Local URLs (default port):

- http://localhost:4000/developer
- http://localhost:4000/openapi.developer.json
- http://localhost:4000/api/docs

## Supported Languages

| Code | Language | Default |
| ---- | -------- | ------- |
| `tr` | Türkçe   | ✅      |
| `en` | English  |         |
| `ru` | Русский  |         |

Future CMS locales: add a file under `apps/api/src/swagger/locales/` and register in `portal-locales.ts`.

## System vs location languages

| Concept | Scope | Admin | API |
| ------- | ----- | ----- | --- |
| **System languages** | Tenant-wide catalog (code, name, RTL, sort, default, active) | **Sistem → Lokalizasyon → Sistem Dilleri** (`/system/localization/languages`) — System Admin only | `GET/POST/PATCH/DELETE /system/locales` — permissions `system-language:*` |
| **Location languages** | Per-mall activation of system-active languages | **Ayarlar → Diller** (`/settings/languages`) — Tenant Admin / Mall Manager | `GET/PATCH /locations/:id/locales` — permissions `location:read` / `location:update` |

Rules:

- **GET endpoints are read-only** — no runtime `Locale` or `MallLocale` provisioning.
- Allowed writes: migration, seed, tenant create, `POST /system/locales`, `PATCH /locations/:id/locales` (enable creates `MallLocale`; disable deletes the row).
- System-inactive languages do **not** appear on the location screen.
- Missing `MallLocale` row → `locationActive: false` (default system language is always active).
- New system language (e.g. `jp`) appears on all locations as **passive** until enabled per location.
- At least one language must stay active per location.
- The tenant default language cannot be disabled at a location.
- `GET /public/site-config` returns only languages that are **both** system-active and location-active.

Legacy `/locales` and `GET /locations/:id/locales/active` are **deprecated**.

Example `GET /locations/:id/locales` response fragment:

```json
[
  {
    "id": "loc_tr",
    "code": "tr",
    "name": "Turkish",
    "nativeName": "Türkçe",
    "rtl": false,
    "sortOrder": 0,
    "isDefault": true,
    "isActive": true,
    "locationActive": true
  },
  {
    "id": "loc_en",
    "code": "en",
    "name": "English",
    "nativeName": "English",
    "rtl": false,
    "sortOrder": 1,
    "isDefault": false,
    "isActive": true,
    "locationActive": false
  }
]
```

Example `GET /public/site-config` fragment (with `x-mall-id`):

```json
{
  "languages": [
    { "code": "tr", "default": true, "rtl": false },
    { "code": "en", "default": false, "rtl": false }
  ],
  "defaultLocale": "tr",
  "activeLocale": "tr"
}
```

## Language Switcher

The Developer Portal (`/developer`) shows a **🌍 Language** selector in the top-right corner.

- Changing language reloads the Scalar spec **without full page reload**
- Preference is stored in `localStorage` (`cms-portal-locale`)
- Default on first visit: `Accept-Language` header → fallback **Turkish**

## Architecture

```
NestJS Controllers (i18n keys, no hardcoded strings)
        ↓
@nestjs/swagger + CLI plugin
        ↓
Base OpenAPI document (keys as placeholders)
        ↓
localizeOpenApiDocument() × (tr, en, ru)
        ↓
/openapi.json  /openapi.en.json  /openapi.ru.json
        ↓
Scalar Developer Portal (/developer)
```

**OpenAPI is the single source of truth.** Never edit generated JSON manually.

## OpenAPI Localization Flow

1. Controllers use **translation keys** in decorators (not human-readable strings)
2. `createOpenApiDocument()` builds the base spec with keys
3. `localizeOpenApiDocument(doc, locale)` replaces keys with translated strings
4. **Main API** `info.description` uses short `intro.summary` only (Scalar Introduction)
5. **Getting Started** content lives in a separate Scalar document at `/developer/getting-started/{locale}.json`
6. Cross-language **search keywords** are injected for endpoint search

## Portal documents (Scalar tabs)

Scalar loads **three** documents via multi-document `sources`:

| Scalar slug | Tab (TR) | Content | OpenAPI URL |
| ----------- | -------- | ------- | ----------- |
| `introduction` | Başlangıç | Auth, SDK, locale, channel, errors | `/developer/getting-started/{locale}.json` |
| `recipes` | Tarifler | Step-by-step page integrations (Homepage, Campaign/Store detail, Search, Header, Footer) | `/developer/recipes/{locale}.json` |
| `api-reference` | API Referansı | Public API only (`/public/*`) with per-endpoint integration guides, code samples, response examples | `/openapi.developer.json` |

Each **API Reference** operation includes:

- `x-dev-guide-key` → localized integration guide (purpose, query params, locale/channel behavior)
- `x-codeSamples` → cURL, fetch, Axios, `CmsPublicClient`, React hook (where applicable)
- `example` on `200` responses where defined

Legacy hashes (`#/description/introduction`) open Getting Started via single-document mount.

**`/api/docs`** and **`/openapi.json`** remain the full backend specification (admin + public).

## Translation Files

| Path                                    | Purpose                               |
| --------------------------------------- | ------------------------------------- |
| `apps/api/src/swagger/locales/tr.ts`    | Turkish strings                       |
| `apps/api/src/swagger/locales/en.ts`    | English strings                       |
| `apps/api/src/swagger/locales/ru.ts`    | Russian strings                       |
| `apps/api/src/swagger/locales/index.ts` | Dictionary loader + parity validation |

### Key naming convention

```
{resource}.{action}.summary       → campaign.list.summary
{resource}.response.{status}      → campaign.response.200
tags.{name}                       → tags.campaigns
tags.{name}.description           → tags.campaigns.description
tagGroup.{group}.name             → tagGroup.content.name
intro.summary                     → Short API Reference intro (one line)
gettingStarted.markdown           → Full Getting Started guide (separate document)
errors.{status}                   → errors.401
header.{name}.description         → header.tenant-id.description
common.permissions.label          → **Permissions:** label
```

## Adding a New Language

1. Add locale code to `PORTAL_LOCALES` in `apps/api/src/swagger/i18n/portal-locales.ts`
2. Create `apps/api/src/swagger/locales/{code}.ts` with **all keys** from `en.ts`
3. Register in `apps/api/src/swagger/locales/index.ts`
4. Add label in `detect-locale.ts` (`LOCALE_LABELS`)
5. Add option in `developer-portal.page.ts` language selector
6. Run `pnpm --filter @modern-cms/api locales:enhance` (optional helper)
7. Run `pnpm build` — parity validation fails if keys are missing

## Adding Translations for a New Endpoint

1. Use a key in the controller:

```typescript
@ApiAdminOperation({ summary: 'campaign.list.summary', permissions: ['campaign:read'] })
```

2. Add entries to **all three** locale files:

```typescript
// en.ts
'campaign.list.summary': 'List campaigns',

// tr.ts
'campaign.list.summary': 'Kampanyaları listele',

// ru.ts
'campaign.list.summary': 'Список кампаний',
```

3. Run `pnpm build` to regenerate OpenAPI artifacts

## Build

```bash
pnpm build
# → apps/api/openapi/openapi.json      (tr)
# → apps/api/openapi/openapi.en.json
# → apps/api/openapi/openapi.ru.json
```

Build fails if:

- OpenAPI generation throws
- Locale parity is broken (tr/ru missing keys from en)
- Any operation lacks summary/responses

Helper script after bulk key changes:

```bash
pnpm --filter @modern-cms/api locales:enhance
```

## Search (Multilingual)

Each operation includes `x-search-keywords` with terms from **all locales**. Scalar search matches:

- `campaign` → Campaign endpoints (English spec)
- `kampanya` → Kampanya endpoints (Turkish spec)
- Cross-language synonyms are embedded in descriptions for indexing

## SDK Examples

Code samples (`CmsPublicClient`, cURL, Fetch, Axios) remain **unchanged** across locales — only explanatory text is translated.

## Authentication Section

Fully translated per locale:

| Key                   | TR                      | EN                     | RU             |
| --------------------- | ----------------------- | ---------------------- | -------------- |
| `tags.authentication` | Kimlik Doğrulama        | Authentication         | Аутентификация |
| `errors.401`          | Eksik veya geçersiz JWT | Missing or invalid JWT | …              |

## Documenting New Endpoints

```typescript
@ApiTags(SWAGGER_TAGS.CAMPAIGNS)
@ApiAdminContext()
@Controller('campaigns')
export class CampaignsController {
  @Get()
  @ApiAdminOperation({
    summary: 'campaign.list.summary',
    permissions: ['campaign:read'],
    related: [SWAGGER_TAGS.STORES],
  })
  @ApiResponse({ status: 200, description: 'campaign.response.200' })
  list() { ... }
}
```

## File Locations

| Path                                            | Description                           |
| ----------------------------------------------- | ------------------------------------- |
| `apps/api/src/swagger/i18n/`                    | Locale detection, localization engine |
| `apps/api/src/swagger/locales/`                 | Translation dictionaries              |
| `apps/api/src/swagger/developer-portal/`        | Endpoint guides, recipes, code samples, enrich |
| `apps/api/src/swagger/developer-portal.page.ts` | Portal HTML + language switcher       |
| `apps/api/src/swagger/generate-openapi.ts`      | Multi-locale build script             |
| `apps/api/openapi/`                             | Generated specs (gitignored)          |
