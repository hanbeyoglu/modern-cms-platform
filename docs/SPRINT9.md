# Sprint 9 — Dynamic Page Builder Foundation

## Overview

Sprint 9 introduces a flexible, tenant-scoped page management system. Admins can create pages composed of ordered content blocks. The foundation is designed so a future public website can fetch and render pages without backend changes.

---

## Architecture

### Page vs. PageBlock

| Concept | Description |
|---------|-------------|
| **Page** | A top-level content entity. Has a title, slug, type, status, SEO fields. Belongs to a tenant and optionally a mall. |
| **PageBlock** | An ordered unit of content within a page. Has a type (hero, rich-text, image…), JSON data, and a sort order. |

A Page contains **zero or more PageBlocks**. The public website fetches the Page by slug, then renders each ACTIVE block in `sortOrder` order.

---

## Prisma Models

### Enums

```prisma
enum PageStatus   { DRAFT | SCHEDULED | PUBLISHED | ARCHIVED }
enum PageType     { STANDARD | LANDING | LEGAL | CONTACT | CUSTOM }
enum PageBlockStatus { ACTIVE | PASSIVE }
```

### Page

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| tenantId | String | Required |
| mallId | String? | Optional — mall-specific page |
| title | String | Required |
| slug | String | Auto-generated from title if not provided |
| type | PageType | STANDARD by default |
| status | PageStatus | DRAFT by default |
| seoTitle | String? | |
| seoDescription | String? | |
| seoKeywords | String? | |
| createdBy | String | User FK |
| updatedBy | String? | User FK |
| publishedAt | DateTime? | Set on publish |
| createdAt / updatedAt / deletedAt | DateTime | Soft delete |

**Unique constraint:** `(tenantId, slug)` — slug is unique per tenant.

### PageBlock

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| tenantId | String | Inherited from parent page |
| mallId | String? | Inherited from parent page |
| pageId | String | FK → Page |
| type | String | Block type identifier |
| title | String? | Optional label |
| dataJson | Json | Block content data |
| sortOrder | Int | Ascending order for rendering |
| status | PageBlockStatus | ACTIVE / PASSIVE |
| createdBy / updatedBy | String | User FKs |
| createdAt / updatedAt / deletedAt | DateTime | Soft delete |

---

## Block Types

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `hero` | Hero banner section | none (title, subtitle, mediaId, buttonText, linkUrl optional) |
| `rich-text` | HTML or plain text content | `html` **or** `text` |
| `image` | Single image | `mediaId` |
| `gallery` | Multiple images | `mediaIds` (array) |
| `video` | Embedded video | `url` **or** `mediaId` |
| `cta` | Call-to-action section | `title` |
| `faq` | FAQ list | `items` (array of `{question, answer}`) |
| `map` | Map embed | `address` **or** (`latitude` + `longitude`) |
| `store-list` | Dynamic store listing | `categoryId`, `featuredOnly` optional |
| `event-list` | Dynamic event listing | `category`, `limit` optional |
| `campaign-list` | Dynamic campaign listing | `storeId`, `limit` optional |
| `custom-html` | Raw HTML injection | `html` required |

### Block Data Examples

**hero:**
```json
{
  "title": "Merhaba",
  "subtitle": "Alt başlık",
  "mediaId": "clxxx",
  "buttonText": "Keşfet",
  "linkUrl": "https://example.com"
}
```

**rich-text:**
```json
{ "html": "<p>Bu bir paragraf.</p>" }
```

**image:**
```json
{ "mediaId": "clxxx" }
```

**gallery:**
```json
{ "mediaIds": ["clxxx", "clyyy", "clzzz"] }
```

**video:**
```json
{ "url": "https://youtube.com/watch?v=..." }
```

**cta:**
```json
{
  "title": "Bize Ulaşın",
  "buttonText": "İletişim",
  "linkUrl": "/contact"
}
```

**faq:**
```json
{
  "items": [
    { "question": "Çalışma saatleriniz nedir?", "answer": "09:00 - 22:00" },
    { "question": "Otopark var mı?", "answer": "Evet, ücretsiz otopark mevcuttur." }
  ]
}
```

**map:**
```json
{ "address": "İstanbul, Türkiye" }
```
or
```json
{ "latitude": 41.015137, "longitude": 28.979530 }
```

**store-list:**
```json
{ "categoryId": "clxxx", "featuredOnly": true }
```

**custom-html:**
```json
{ "html": "<div>Özel içerik</div>" }
```

> ⚠️ **Security Warning — custom-html:** The `custom-html` block type accepts raw HTML. This HTML is stored as-is and rendered directly by the public website. **Never render custom-html without proper XSS sanitization on the public website layer.** Do not allow untrusted users to create `custom-html` blocks.

---

## API Endpoints

All endpoints require `x-tenant-id` header. `x-mall-id` is optional.

### Pages

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/pages` | `page:read` | List pages (paginated, filterable) |
| GET | `/pages/:id` | `page:read` | Get single page with blocks |
| POST | `/pages` | `page:create` | Create page |
| PATCH | `/pages/:id` | `page:update` | Update page metadata |
| DELETE | `/pages/:id` | `page:delete` | Soft delete |
| POST | `/pages/:id/publish` | `page:publish` | Publish page |
| POST | `/pages/:id/archive` | `page:archive` | Archive page |

**List query params:** `status`, `type`, `search`, `sortBy` (createdAt/updatedAt/title), `sortDir`, `page`, `limit`

### Page Blocks

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/pages/:pageId/blocks` | `page-block:read` | List blocks for a page |
| POST | `/pages/:pageId/blocks` | `page-block:create` | Add block to page |
| PATCH | `/pages/:pageId/blocks/reorder` | `page-block:reorder` | Reorder blocks |
| PATCH | `/pages/:pageId/blocks/:blockId` | `page-block:update` | Update block |
| DELETE | `/pages/:pageId/blocks/:blockId` | `page-block:delete` | Soft delete block |

**Note:** The `reorder` route is defined **before** `:blockId` in the controller to avoid route conflict.

---

## Permissions

| Permission | Description |
|-----------|-------------|
| `page:read` | View pages |
| `page:create` | Create pages |
| `page:update` | Edit page metadata |
| `page:delete` | Soft delete pages |
| `page:publish` | Publish pages |
| `page:archive` | Archive pages |
| `page-block:read` | View blocks |
| `page-block:create` | Add blocks to pages |
| `page-block:update` | Edit block content |
| `page-block:delete` | Delete blocks |
| `page-block:reorder` | Reorder blocks |

### Role Assignments

| Role | Permissions |
|------|------------|
| SUPER_ADMIN | All |
| TENANT_ADMIN | All |
| MALL_MANAGER | All except `page:delete` |
| CONTENT_EDITOR | read, create, update (no delete, publish, archive) + block CRUD + reorder |
| REPORT_VIEWER | read only |

---

## Public Rendering Strategy

Two service methods are provided for future public website integration:

### `getPublishedPageForPublic({ tenantId, mallId, slug })`

- Returns a single page matching the slug
- Only PUBLISHED, not soft-deleted
- Includes only ACTIVE blocks, ordered by sortOrder
- Mall scoping: if `mallId` is given, returns pages with `mallId = given` OR `mallId = null` (tenant-level fallback)
- Returns `null` if not found (404 to be handled by website layer)

### `getPublishedPagesForPublic({ tenantId, mallId, type })`

- Returns all published pages for a tenant
- Same mall scoping rules
- Optional `type` filter (e.g. `LEGAL` for footer links)
- Ordered by `createdAt` descending

**Mall scoping behavior:** A page with `mallId = null` is a tenant-level page visible in all mall contexts. A page with a specific `mallId` is only visible in that mall's context. When `mallId` is provided, both specific and tenant-level pages are returned.

---

## Admin Usage

### Pages List (`/pages`)

- View all pages with status and type badges
- Filter by status (DRAFT / SCHEDULED / PUBLISHED / ARCHIVED)
- Filter by type (STANDARD / LANDING / LEGAL / CONTACT / CUSTOM)
- Search by title or slug
- Quick-create new page (navigates to detail after creation)
- Publish / Archive from list
- Soft delete with confirmation

### Page Detail (`/pages/:id`)

- Edit page metadata (title, slug, type, status, SEO fields)
- Full SEO section (title, description, keywords)
- Block list with sort order indicators
- Add new block (type selector + JSON textarea with defaults)
- Edit existing block
- Delete block with confirmation
- Reorder blocks with ▲▼ buttons (calls bulk reorder API)
- Publish / Archive / Delete page from the top action bar

---

## Audit Behavior

All mutations produce an `AuditLog` entry via `AuditLogService`.

| Action | Trigger | Before/After |
|--------|---------|-------------|
| `page:create` | POST /pages | after: title, status, slug, type |
| `page:update` | PATCH /pages/:id | before/after: title, status |
| `page:delete` | DELETE /pages/:id | before: title, status |
| `page:publish` | POST /pages/:id/publish | before: status, after: status + publishedAt |
| `page:archive` | POST /pages/:id/archive | before: status, after: status |
| `page-block:create` | POST /pages/:pageId/blocks | after: pageId, type, sortOrder |
| `page-block:update` | PATCH …/blocks/:blockId | before/after: type, sortOrder |
| `page-block:delete` | DELETE …/blocks/:blockId | before: type, sortOrder |
| `page-block:reorder` | PATCH …/blocks/reorder | after: blocks array |

---

## Security Notes

1. **custom-html XSS:** The API stores raw HTML without sanitization. The public website **must** sanitize before rendering (DOMPurify or similar).
2. **Tenant isolation:** All queries enforce `tenantId` from the `x-tenant-id` header. Cross-tenant access is impossible through normal API usage.
3. **Mall scoping:** `mallId` from `x-mall-id` is validated by `MallAccessGuard` before reaching controllers.
4. **Block data validation:** The `validateBlockData` utility performs basic schema checks (required fields) but does not prevent injection of arbitrary keys. Future work: JSON schema registry per block type.
5. **Slug uniqueness:** Soft-deleted pages do not affect slug uniqueness (query filters `deletedAt: null`). This means re-creating a deleted slug is possible.

---

## Known Limitations

1. **No drag-and-drop:** Block reorder uses ▲/▼ buttons. Full DnD can be added in a future sprint.
2. **No visual block preview:** Block data is displayed as JSON in the admin. A rich preview renderer can be added later.
3. **No block schema registry:** Block data shape is defined in code (`block-data-validation.ts`). A dynamic schema registry (JSON Schema / Zod) can replace this in a future sprint.
4. **No scheduled publish:** `SCHEDULED` status exists but is not auto-published. A cron job or background worker is needed to transition at `publishedAt`.
5. **No version history:** Page and block changes are audited but not versioned. A versioning system would require a new table.
6. **custom-html blocks require sanitization at render time** — this is a documentation-only guardrail for now.

---

## Files Changed

### Backend (`apps/api`)

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Added `PageStatus`, `PageType`, `PageBlockStatus` enums; `Page`, `PageBlock` models; relations on `User`, `Tenant`, `Mall` |
| `prisma/migrations/…_sprint9_page_builder/migration.sql` | Auto-generated migration |
| `prisma/seed.ts` | Added 11 page/page-block permissions; updated role assignments |
| `src/common/utils/unique-content-slug.ts` | Added `uniquePageSlug` |
| `src/common/utils/block-data-validation.ts` | New — block type + data validation |
| `src/pages/dto/create-page.dto.ts` | New |
| `src/pages/dto/update-page.dto.ts` | New |
| `src/pages/dto/list-pages.dto.ts` | New |
| `src/pages/pages.service.ts` | New |
| `src/pages/pages.controller.ts` | New |
| `src/pages/pages.module.ts` | New |
| `src/page-blocks/dto/create-page-block.dto.ts` | New |
| `src/page-blocks/dto/update-page-block.dto.ts` | New |
| `src/page-blocks/dto/reorder-blocks.dto.ts` | New |
| `src/page-blocks/page-blocks.service.ts` | New |
| `src/page-blocks/page-blocks.controller.ts` | New |
| `src/page-blocks/page-blocks.module.ts` | New |
| `src/app.module.ts` | Registered `PagesModule`, `PageBlocksModule` |

### Frontend (`apps/admin`)

| File | Action |
|------|--------|
| `src/lib/api/pages.ts` | New — full API client |
| `src/lib/api/index.ts` | Added pages exports |
| `src/pages/PagesPage.tsx` | New — list + create |
| `src/pages/PageDetailPage.tsx` | New — metadata + block management |
| `src/router/index.tsx` | Added `/pages` and `/pages/:id` routes |
| `src/navigation/config.ts` | Added "Sayfalar" nav item |

### Documentation

| File | Action |
|------|--------|
| `docs/SPRINT9.md` | New |
