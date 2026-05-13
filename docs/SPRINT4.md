# Sprint 4 — Slider Management Module

## Overview

Sprint 4 implements the first CMS content module: **Slider Management**. Admins can create, edit, publish, archive, and reorder homepage sliders scoped to a tenant or a specific mall.

---

## Slider Model

**Table:** `Slider`

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key |
| `tenantId` | `String` | Required. Tenant scope. |
| `mallId` | `String?` | Optional. Mall scope. |
| `title` | `String` | Required. |
| `subtitle` | `String?` | Optional. |
| `description` | `String?` | Optional. |
| `desktopMediaId` | `String?` | FK → MediaAsset |
| `mobileMediaId` | `String?` | FK → MediaAsset |
| `videoMediaId` | `String?` | FK → MediaAsset |
| `linkType` | `SliderLinkType` | Default: `NONE` |
| `linkValue` | `String?` | Required when linkType is `EXTERNAL_URL` |
| `buttonText` | `String?` | CTA button label |
| `startAt` | `DateTime?` | Visibility start date |
| `endAt` | `DateTime?` | Visibility end date |
| `sortOrder` | `Int` | Default: `0`. Lower = first. |
| `status` | `SliderStatus` | Default: `DRAFT` |
| `targetDevice` | `SliderTargetDevice` | Default: `ALL` |
| `createdBy` | `String` | FK → User |
| `updatedBy` | `String?` | FK → User |
| `createdAt` | `DateTime` | Auto |
| `updatedAt` | `DateTime` | Auto |
| `deletedAt` | `DateTime?` | Soft delete |

### Enums

**SliderStatus**
- `DRAFT` — Not visible, work in progress
- `SCHEDULED` — Scheduled for future publish (informational)
- `PUBLISHED` — Live and active
- `ARCHIVED` — Hidden, soft-disabled

**SliderTargetDevice**
- `ALL` — Shown on all devices
- `DESKTOP` — Shown only on desktop
- `MOBILE` — Shown only on mobile

**SliderLinkType**
- `NONE` — No link
- `EXTERNAL_URL` — Absolute URL (validated)
- `INTERNAL_PAGE` — Internal CMS page slug
- `EVENT` — Links to an event (future)
- `CAMPAIGN` — Links to a campaign (future)
- `STORE` — Links to a store (future)

---

## Permissions

| Code | Description |
|---|---|
| `slider:read` | View sliders |
| `slider:create` | Create sliders |
| `slider:update` | Edit sliders |
| `slider:delete` | Soft-delete sliders |
| `slider:publish` | Publish sliders (validates media) |
| `slider:reorder` | Reorder sliders |

### Role Assignments

| Role | Permissions |
|---|---|
| `SUPER_ADMIN` | All slider permissions |
| `TENANT_ADMIN` | All slider permissions |
| `MALL_MANAGER` | All slider permissions |
| `CONTENT_EDITOR` | `slider:read`, `slider:create`, `slider:update` |
| `REPORT_VIEWER` | `slider:read` |

---

## API Endpoints

All endpoints require:
- `Authorization: Bearer <token>` header
- `x-tenant-id: <tenantId>` header
- Optional: `x-mall-id: <mallId>` header (scopes to specific mall)

### List Sliders

```
GET /sliders
```

Query params:
- `status` — Filter by `SliderStatus`
- `targetDevice` — Filter by `SliderTargetDevice`
- `search` — Case-insensitive title search
- `page` — Default: 1
- `limit` — Default: 20, max: 100

Response:
```json
{
  "sliders": [...],
  "total": 5,
  "page": 1,
  "limit": 20
}
```

### Get Single Slider

```
GET /sliders/:id
```

### Create Slider

```
POST /sliders
```

Body:
```json
{
  "title": "Yaz Kampanyası",
  "subtitle": "En iyi fırsatlar",
  "desktopMediaId": "clxyz...",
  "linkType": "EXTERNAL_URL",
  "linkValue": "https://example.com/kampanya",
  "buttonText": "Keşfet",
  "sortOrder": 0,
  "status": "DRAFT",
  "targetDevice": "ALL"
}
```

### Update Slider

```
PATCH /sliders/:id
```

Partial update. All fields optional.

### Delete Slider (Soft)

```
DELETE /sliders/:id
```

Returns `204 No Content`.

### Publish Slider

```
POST /sliders/:id/publish
```

Validates that at least one media asset (desktop, mobile, or video) is attached. Sets status to `PUBLISHED`.

### Archive Slider

```
POST /sliders/:id/archive
```

Sets status to `ARCHIVED`.

### Reorder Sliders

```
PATCH /sliders/reorder
```

Body:
```json
{
  "items": [
    { "id": "slider1", "sortOrder": 0 },
    { "id": "slider2", "sortOrder": 1 },
    { "id": "slider3", "sortOrder": 2 }
  ]
}
```

Validates all slider IDs belong to the same tenant/mall scope. Executes in a database transaction.

---

## cURL Examples

```bash
# Login (get token)
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@example.com","password":"SuperAdmin123!"}' \
  | jq -r '.accessToken')

# Set headers for convenience
TENANT_ID="<your-tenant-id>"
HEADERS='-H "Authorization: Bearer '"$TOKEN"'" -H "x-tenant-id: '"$TENANT_ID"'"'

# List sliders
curl -s http://localhost:4000/sliders \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq

# Create slider
curl -s -X POST http://localhost:4000/sliders \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Yaz Kampanyası",
    "subtitle": "Harika fırsatlar",
    "linkType": "NONE",
    "sortOrder": 0,
    "status": "DRAFT",
    "targetDevice": "ALL"
  }' | jq

# Publish slider (replace SLIDER_ID)
SLIDER_ID="<slider-id>"
curl -s -X POST http://localhost:4000/sliders/$SLIDER_ID/publish \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq

# Archive slider
curl -s -X POST http://localhost:4000/sliders/$SLIDER_ID/archive \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq

# Reorder sliders
curl -s -X PATCH http://localhost:4000/sliders/reorder \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"id":"id1","sortOrder":0},{"id":"id2","sortOrder":1}]}' | jq

# Delete slider
curl -s -X DELETE http://localhost:4000/sliders/$SLIDER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" -o /dev/null -w "%{http_code}"

# Filter by status
curl -s "http://localhost:4000/sliders?status=PUBLISHED" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq

# Search
curl -s "http://localhost:4000/sliders?search=kampanya" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" | jq

# Mall-scoped sliders
curl -s http://localhost:4000/sliders \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-mall-id: $MALL_ID" | jq
```

---

## Admin UI Usage

Navigate to **Slider Yönetimi** in the admin navigation bar.

### List View
- Shows all sliders for the active tenant (and mall if x-mall-id is set)
- Status filter and search input in the toolbar
- Each row shows: title, status badge (colored), device badge, media types, sort order, creation date
- Desktop media preview thumbnail shown when available

### Create / Edit
- Click **+ Yeni Slider** to open the create form
- Click **Düzenle** on any row to edit
- Form fields: title, subtitle, description, desktop/mobile/video media (selected from existing media assets), link type and value, button text, start/end dates, target device, sort order, status

### Actions per Slider
- **Düzenle** — Open edit form
- **Yayınla** — Publish slider (requires at least one media asset; shows error if missing)
- **Arşivle** — Archive slider
- **Sil** — Soft-delete with confirmation prompt

### Media Selection
Media assets are loaded from the active tenant's media library. Select from the dropdown in the form. For images, a thumbnail preview is shown in the list.

---

## Tenant/Mall Access Behavior

| Actor | Behavior |
|---|---|
| Super Admin | Can access all tenants. No `x-tenant-id` required. |
| Tenant Admin | Can manage all sliders within their tenant. |
| Mall Manager | Can manage sliders. If `x-mall-id` is set, scoped to that mall only. |
| Content Editor | Can read, create, and update sliders. Cannot publish or delete. |
| Report Viewer | Read-only access. |

**Tenant-level sliders** (`mallId = null`) are visible across all malls under the tenant.
**Mall-level sliders** (`mallId` set) are only visible when querying with the matching `x-mall-id` header.

---

## Audit Log Events

All slider actions are recorded in the `AuditLog` table.

| Action | Trigger | Payload |
|---|---|---|
| `slider:create` | POST /sliders | after: { title, status } |
| `slider:update` | PATCH /sliders/:id | before/after: { title, status } |
| `slider:delete` | DELETE /sliders/:id | before: { title, status } |
| `slider:publish` | POST /sliders/:id/publish | before/after: { status } |
| `slider:archive` | POST /sliders/:id/archive | before/after: { status } |
| `slider:reorder` | PATCH /sliders/reorder | after: { itemCount, ids } |

---

## Public Readiness

The `SlidersService` exposes `getPublishedSlidersForPublic({ tenantId, mallId?, targetDevice? })` for future public website consumption. This method:

- Filters `status = PUBLISHED`
- Applies date range filtering (`startAt <= now <= endAt`, with null treated as unbounded)
- Applies device targeting if provided
- Orders by `sortOrder ASC`

No public HTTP route is created in Sprint 4. Add `PublicSlidersController` in a future sprint once the public website layer exists.

---

## Migration & Seed Commands

```bash
# From apps/api directory:

# Run migration
pnpm db:migrate
# or: npx prisma migrate dev --name add-slider-module

# Apply migration (production)
pnpm db:migrate:deploy

# Seed (adds new permissions, idempotent)
pnpm db:seed
```

---

## Known Limitations

1. **No drag-and-drop reorder in UI** — Reorder must be done via the API directly or a future DnD implementation.
2. **Media picker is a basic select** — Shows file names without thumbnails. A full media picker modal is planned for Sprint 5+.
3. **No strict status machine enforcement** — Status can be freely set via PATCH. The `publish` endpoint enforces media presence; other transitions are unrestricted.
4. **`INTERNAL_PAGE`, `EVENT`, `CAMPAIGN`, `STORE` link types** — `SliderLinkType` values are defined but corresponding entities don't exist yet. linkValue is stored as a plain string for these types.
5. **No public endpoint** — `getPublishedSlidersForPublic()` exists as a service method but no HTTP route is exposed yet.
6. **Pagination in UI** — The admin page loads up to 50 sliders; pagination UI is not implemented.
