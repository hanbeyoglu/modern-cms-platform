# Sprint 12A — Localization Backend Foundation

## Overview

Sprint 12A adds the database models, permission layer, locale management API,
translation storage API, and a resolver service foundation for multi-language
content delivery. Public delivery responses and admin UI are **not** modified in
this sprint.

---

## Architecture: Translation-Table Strategy

Rather than duplicating entire content rows per language (locale-copy strategy),
we store translated field values in a single `LocalizedContent` table keyed by
`(tenantId, localeId, entityType, entityId, field)`.

**Advantages:**
- Adding a new locale requires no schema changes to content tables.
- Partial translations work naturally — untranslated fields fall back to the base value.
- Content models remain clean; all i18n concerns are isolated in one table.
- A single batch query can load all translations for a list of entities (no N+1).

**Trade-off:**
- Querying translated content requires a join or a separate lookup; handled by
  `TranslationResolverService` in Sprint 12B.

---

## Prisma Models

### Locale

```prisma
model Locale {
  id         String   @id @default(cuid())
  tenantId   String
  code       String                     // normalized lowercase, e.g. "tr", "en"
  name       String                     // display name, e.g. "Turkish"
  nativeName String                     // e.g. "Türkçe"
  isDefault  Boolean  @default(false)   // exactly one default per tenant
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([tenantId, code])
  @@index([tenantId])
}
```

**Invariants:**
- Exactly one `isDefault=true` locale per tenant at all times.
- Deactivating the default locale auto-transfers the default flag to the next
  active locale (in a single transaction).
- Deleting a locale uses soft-deactivation (`isActive=false`) to preserve
  translation data. Physical delete would cascade-delete all translations.

### LocalizedContent

```prisma
model LocalizedContent {
  id         String              @id @default(cuid())
  tenantId   String
  localeId   String
  entityType LocalizedEntityType
  entityId   String
  field      String              // e.g. "title", "description", "buttonText"
  value      String
  createdAt  DateTime            @default(now())
  updatedAt  DateTime            @updatedAt

  @@unique([tenantId, localeId, entityType, entityId, field])
  @@index([tenantId, localeId])
  @@index([entityType, entityId])
}
```

### LocalizedEntityType Enum

```
PAGE | PAGE_BLOCK | SLIDER | EVENT | CAMPAIGN | STORE | MOVIE | CINEMA
```

---

## Permission Matrix

| Permission          | SUPER_ADMIN | TENANT_ADMIN | MALL_MANAGER | CONTENT_EDITOR | REPORT_VIEWER |
|---------------------|-------------|--------------|--------------|----------------|---------------|
| locale:read         | ✓           | ✓            | ✓            | ✓              | —             |
| locale:create       | ✓           | ✓            | —            | —              | —             |
| locale:update       | ✓           | ✓            | —            | —              | —             |
| locale:delete       | ✓           | ✓            | —            | —              | —             |
| locale:set-default  | ✓           | ✓            | —            | —              | —             |
| translation:read    | ✓           | ✓            | ✓            | ✓              | —             |
| translation:create  | ✓           | ✓            | ✓            | ✓              | —             |
| translation:update  | ✓           | ✓            | ✓            | ✓              | —             |
| translation:delete  | ✓           | ✓            | —            | —              | —             |

---

## Endpoints

### Locales (`/locales`)

All endpoints require `x-tenant-id` header and a valid JWT.

| Method | Path                  | Permission         | Description                        |
|--------|-----------------------|--------------------|------------------------------------|
| GET    | /locales              | locale:read        | List tenant locales                |
| POST   | /locales              | locale:create      | Create a locale                    |
| PATCH  | /locales/:id          | locale:update      | Update locale name/code/active     |
| DELETE | /locales/:id          | locale:delete      | Deactivate locale (see note below) |
| POST   | /locales/:id/default  | locale:set-default | Set as the tenant default          |

> **DELETE behavior:** The endpoint sets `isActive=false` rather than physically
> deleting the record. This preserves `LocalizedContent` rows. If the target
> locale is the current default, the default flag is atomically transferred to
> the next available active locale. If no other active locale exists, a 400 is
> returned.

### Translations (`/translations`)

All endpoints require `x-tenant-id` header and a valid JWT.

| Method | Path              | Permission         | Description                      |
|--------|-------------------|--------------------|----------------------------------|
| GET    | /translations     | translation:read   | List with filters                |
| POST   | /translations     | translation:create | Create or upsert a translation   |
| PATCH  | /translations/:id | translation:update | Update a translation's value     |
| DELETE | /translations/:id | translation:delete | Hard-delete a translation record |

**GET /translations query filters:**
- `entityType` — filter by entity type enum value
- `entityId` — filter by entity ID
- `localeId` — filter by locale ID
- `localeCode` — alternative to localeId (e.g. `?localeCode=tr`)
- `field` — filter by field name

**POST /translations upsert behavior:** If a translation for the same
`(tenantId, localeId, entityType, entityId, field)` already exists it is updated
in-place instead of raising a conflict. This makes bulk import idempotent.
Either `localeId` or `localeCode` must be provided.

---

## cURL Examples

### Authenticate

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@example.com","password":"SuperAdmin123!"}' \
  | jq -r '.accessToken')
```

### Get tenant ID

```bash
TENANT_ID=$(curl -s http://localhost:3000/tenants \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.tenants[0].id')
```

### List locales

```bash
curl http://localhost:3000/locales \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"
```

### Create a locale

```bash
curl -X POST http://localhost:3000/locales \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{"code":"de","name":"German","nativeName":"Deutsch"}'
```

### Set default locale

```bash
curl -X POST http://localhost:3000/locales/<locale-id>/default \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"
```

### Create / upsert a translation

```bash
curl -X POST http://localhost:3000/translations \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "localeCode": "en",
    "entityType": "SLIDER",
    "entityId": "<slider-id>",
    "field": "title",
    "value": "Summer Collection"
  }'
```

### List translations for a slider

```bash
curl "http://localhost:3000/translations?entityType=SLIDER&entityId=<slider-id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"
```

### Update a translation

```bash
curl -X PATCH http://localhost:3000/translations/<translation-id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{"value":"Summer Sale"}'
```

### Delete a translation

```bash
curl -X DELETE http://localhost:3000/translations/<translation-id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"
```

---

## TranslationResolverService

Located at `src/translation-resolver/translation-resolver.service.ts`.

This service is the internal engine for Sprint 12B. It is **not** wired into any
HTTP controller in this sprint.

### API

```typescript
// Returns the locale to use for a request; falls back to the tenant default.
resolveLocale(tenantId: string, requestedLocaleCode?: string): Promise<Locale | null>

// Returns the tenant's current default active locale.
getDefaultLocale(tenantId: string): Promise<Locale | null>

// Returns all translation records for one entity.
getTranslationsForEntity(
  tenantId: string,
  localeId: string,
  entityType: LocalizedEntityType,
  entityId: string,
): Promise<LocalizedContent[]>

// Batch loader — returns a map of entityId → { field: value } using a single query.
getTranslationsForEntities(
  tenantId: string,
  localeId: string,
  entityType: LocalizedEntityType,
  entityIds: string[],
): Promise<EntityTranslationMap>

// Overlays translated values onto a base object (shallow copy, non-mutating).
// fieldMap maps object property names → translation field names.
// If omitted, property names are treated as equal to field names.
applyTranslationsToObject<T>(
  baseObject: T,
  translations: LocalizedContent[],
  fieldMap?: Record<string, string>,
): T
```

### Usage pattern for Sprint 12B

```typescript
const locale = await resolver.resolveLocale(tenantId, req.headers['accept-language']);
if (locale) {
  const translationMap = await resolver.getTranslationsForEntities(
    tenantId, locale.id, 'SLIDER', sliders.map(s => s.id)
  );
  return sliders.map(s =>
    resolver.applyTranslationsToObject(s, toArray(translationMap[s.id]), ['title', 'subtitle'])
  );
}
```

---

## Migration

```bash
# From apps/api/
npx prisma migrate dev --name add-localization-foundation
```

## Seed

```bash
# From repo root
pnpm --filter api seed
# or from apps/api/
npx ts-node --project tsconfig.json -e "require('./prisma/seed.ts')"
# or with prisma
npx prisma db seed
```

---

## Known Limitations

1. **No public API localization yet.** Public endpoints return base content only.
   Sprint 12B will wire `TranslationResolverService` into `PublicContentService`.

2. **No admin UI.** Locale and translation management requires the API directly
   until Sprint 12B admin components are built.

3. **Locale deactivation instead of deletion.** The DELETE endpoint deactivates
   (`isActive=false`) rather than physically removing the record. To truly purge
   a locale and all its translations, manually delete via the database.

4. **No AI-assisted translation.** Machine translation (e.g. DeepL / OpenAI) is
   out of scope. Values must be provided manually.

5. **No fallback chain.** If a translation is missing for the requested locale,
   the base field value is returned as-is. A fallback locale chain (e.g.
   `en-US → en → default`) is not implemented.

6. **Mall scope not on translation rows.** Translations are scoped to tenant +
   locale only. The entity itself carries mall scope where applicable.
