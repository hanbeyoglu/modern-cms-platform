# Sprint 23 — Media Library V2 & Asset Management System

## Overview

Sprint 23 upgrades the basic media upload layer into a production-grade asset management system with rich metadata, folder management, usage tracking, image focal points, variant scaffolding, and a fully reworked admin UI.

---

## Tenant-First Admin Context

The admin app now treats tenant context as the first step after login.

### Entry flow

1. Login stores the auth session and opens the protected admin flow.
2. If the user has more than one enabled tenant, or is a Super Admin, protected routes send them to `/select-tenant`.
3. If the user has exactly one enabled tenant and is not a Super Admin, that tenant is selected automatically.
4. After tenant selection, the app loads locations/malls for that tenant.
5. If there is exactly one location, it is selected automatically and the user continues to `/dashboard`.
6. If there are multiple locations, `/select-location` asks the user to choose one before entering the dashboard.

### Context persistence and safety

- Selected tenant and location are stored in `localStorage` under `modern-cms.admin.context`.
- Changing tenant resets the selected location.
- A disabled tenant is never restored as active; stale tenant context is cleared and the user is forced back to tenant selection.
- If the stored location no longer belongs to the selected tenant, location context is cleared and the user is sent back through location selection when needed.
- The existing `TenantMallSelector` remains in the admin header and shows the current tenant/location context clearly for in-session changes.

---

## Asset Management Architecture

### MediaAsset Model (enhanced)

| Field | Type | Purpose |
|---|---|---|
| `altText` | `String?` | Accessibility alt text |
| `caption` | `String?` | Display caption below image |
| `description` | `String?` | Long-form editorial description |
| `tags` | `String[]` | PostgreSQL text array for fast tag filtering |
| `folderId` | `String?` | Parent folder (nullable = root) |
| `durationSeconds` | `Float?` | For video/audio assets |
| `focalPointX/Y` | `Float?` | Normalized 0.0–1.0 coordinates for smart crop |
| `dominantColor` | `String?` | Hex color (future: auto-extract from image) |
| `source` | `String?` | Attribution / origin label |
| `checksum` | `String?` | SHA-256 or MD5 of file content |
| `status` | `MediaAssetStatus` | `ACTIVE` or `ARCHIVED` |

### MediaAssetStatus Enum

```
ACTIVE    – visible in default list queries
ARCHIVED  – hidden from default queries; retrievable with explicit status filter
```

---

## Folder Strategy

### MediaFolder Model (enhanced)

- Added `sortOrder Int @default(0)` for manual reordering
- Added `deletedAt DateTime?` for soft-delete
- Existing `parentId` enables unlimited nesting

### Rules

- Delete is blocked if folder has assets or subfolders (hard error)
- Moving folder hierarchy is out of scope (move assets individually)
- `listFolders` returns only non-deleted folders ordered by `sortOrder ASC, name ASC`

---

## Metadata Strategy

### Tags

Tags are stored as a native PostgreSQL `text[]` array on `MediaAsset`. This enables:
- `tags: { has: "banner" }` — single-tag filter in Prisma
- No join table overhead
- Clean array in API response

Alternative (rejected): a `MediaTag` join table would allow tag management UI but adds complexity without proportional benefit at current scale.

### Focal Point

Stored as `focalPointX` / `focalPointY` as floats in [0, 1] range.

- `(0.5, 0.5)` = center (default behavior)
- `(0.2, 0.8)` = 20% from left, 80% from top
- Consumer systems (CDN, image transforms) read these to guide smart crop

---

## Usage Tracking

`GET /media/:id/usages` queries 11 relation tables dynamically without a dedicated join table:

| Entity | Relations checked |
|---|---|
| Slider | `desktopMedia`, `mobileMedia`, `videoMedia` |
| GlobalStore | `logo` |
| MallStore | `localLogo` |
| Event | `coverMedia` |
| Campaign | `coverMedia` |
| Cinema | `logo` |
| Movie | `poster` |
| Mall/Location | `logo`, `cover` |

Response shape:
```json
[
  {
    "entityType": "slider",
    "entityId": "clxxx",
    "entityName": "Yaz Sezonu Slider",
    "field": "desktopMedia",
    "route": "/sliders/clxxx"
  }
]
```

Performance: each `findMany` query is scoped to `tenantId` and uses FK indexes. All 11 queries run in a single `Promise.all`.

---

## CDN Readiness

### Current state

Assets are served from the local filesystem via `LocalStorageProvider`. The `publicUrl` is already an absolute HTTP URL (no internal paths exposed).

### Future provider support

`StorageProvider` is an abstract class:

```typescript
abstract class StorageProvider {
  abstract upload(opts: UploadOpts): Promise<{ publicUrl: string }>;
  abstract delete(key: string): Promise<void>;
  abstract getPublicUrl(key: string): string;
}
```

Swapping to R2/S3:
1. Implement `R2StorageProvider extends StorageProvider`
2. Set `STORAGE_PROVIDER=r2` env var
3. Switch factory in `MediaModule`

No code changes needed in service/controller layer.

### CDN base URL

Set `CDN_BASE_URL` env var to override the base URL for `publicUrl` generation in `LocalStorageProvider`. The `R2StorageProvider` would use the R2 public bucket URL.

---

## Variant / Optimization Foundation

### MediaVariant model

```prisma
model MediaVariant {
  id           String   @id @default(cuid())
  mediaAssetId String
  variantKey   String   // e.g. "thumb_200", "webp_800", "avif_1200"
  url          String
  width        Int?
  height       Int?
  mimeType     String
  fileSize     Int
  createdAt    DateTime @default(now())
}
```

### Future worker pipeline

When an image is uploaded:
1. Upload worker receives `mediaAssetId` via queue (BullMQ)
2. Worker resizes to configured breakpoints (e.g. 400, 800, 1200px)
3. Worker converts to WebP + AVIF
4. Creates `MediaVariant` rows with correct `variantKey`
5. Consumers request `GET /media/:id/variants` to pick optimal variant

Current sprint: model is created, no processing runs. Variants are empty until the worker is implemented.

---

## Storage Provider Future Plan

| Phase | Provider | Config |
|---|---|---|
| Dev / Staging | `LocalStorageProvider` | `STORAGE_ROOT=./storage` |
| Production | `R2StorageProvider` | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET` |
| Enterprise | `S3StorageProvider` | Standard AWS env vars |

All providers return a `publicUrl` — no internal storage path ever reaches the API response.

---

## New Permissions

| Permission | Description |
|---|---|
| `media:update` | Update asset metadata (altText, caption, tags, focal point) |
| `media:manage-folders` | Create, rename, delete folders |

### Role assignments

| Role | media:update | media:manage-folders |
|---|---|---|
| SUPER_ADMIN | ✓ | ✓ |
| TENANT_ADMIN | ✓ | ✓ |
| MALL_MANAGER | ✓ | ✓ |
| CONTENT_EDITOR | ✓ | — |
| REPORT_VIEWER | — | — |

---

## New API Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/media` | `media:read` | List assets (filterable) |
| `GET` | `/media/:id` | `media:read` | Get single asset |
| `PATCH` | `/media/:id` | `media:update` | Update metadata |
| `DELETE` | `/media/:id` | `media:delete` | Soft-delete asset |
| `GET` | `/media/:id/usages` | `media:read` | Get usage references |
| `PATCH` | `/media/:id/move` | `media:update` | Move to folder |
| `GET` | `/media/folders` | `media:read` | List folders |
| `POST` | `/media/folders` | `media:manage-folders` | Create folder |
| `PATCH` | `/media/folders/:id` | `media:manage-folders` | Rename / reorder folder |
| `DELETE` | `/media/folders/:id` | `media:manage-folders` | Delete empty folder |

### List filtering (`GET /media`)

| Param | Type | Notes |
|---|---|---|
| `folderId` | string | Filter by folder |
| `mallId` | string | Filter by location |
| `mimeType` | string | Prefix match (e.g. `image/`) |
| `tag` | string | Exact tag match |
| `search` | string | OR search across name/altText/caption/description |
| `status` | enum | Defaults to `ACTIVE` |
| `dateFrom` / `dateTo` | ISO8601 | Created-at range |
| `page` / `limit` | int | Pagination |

---

## Audit Events

| Action | Trigger |
|---|---|
| `media:upload` | File uploaded |
| `media:update` | Metadata patched |
| `media:delete` | Asset soft-deleted |
| `media:move` | Asset moved to different folder |
| `media-folder:create` | Folder created |
| `media-folder:update` | Folder renamed / reordered |
| `media-folder:delete` | Folder soft-deleted |

---

## Admin UI Summary

### MediaPage features (Sprint 23)

- **Grid / List toggle** — grid card view or tabular list view
- **Folder sidebar** — click to filter by folder; rename (✎) and delete (✕) per folder
- **Folder create** — inline input in sidebar
- **Upload area** — single-file upload, shows progress feedback
- **Search bar** — client-driven search (triggers API re-fetch)
- **MIME filter** — dropdown to filter by file type prefix
- **Asset detail drawer** — opens on click:
  - Image preview (full contain)
  - File info (MIME, size, dimensions)
  - URL copy button
  - Detail tab: edit altText, caption, description, tags, focal point X/Y; save button
  - Usage tab: shows all entities referencing the asset
  - Move to folder selector
  - Delete with inline confirm (no browser alert)
- **Tags** — displayed as chips in grid and list view; editable in drawer
- **Empty states** — empty folder and no-results-found states

---

## Migration

```bash
# Apply migration (CI / production)
pnpm --filter api exec prisma migrate deploy

# Re-seed permissions and roles
pnpm --filter api exec prisma db seed
```

Migration file: `apps/api/prisma/migrations/20260515230000_sprint23_media_v2/migration.sql`
