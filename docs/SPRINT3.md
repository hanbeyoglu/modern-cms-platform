# Sprint 3 — Media Library & Upload Infrastructure

## Goal

Establish a production-grade, provider-agnostic media upload and storage system before building CMS content modules. Every future module (sliders, events, campaigns, stores, page builder) depends on this foundation.

---

## What Changed

### API (`apps/api`)

| File | Change |
|---|---|
| `prisma/schema.prisma` | Added `MediaFolder` and `MediaAsset` models; back-relations on `User`, `Tenant`, `Mall` |
| `prisma/seed.ts` | Added `media:read`, `media:upload`, `media:delete` permissions; updated all role definitions |
| `src/media/constants/media.constants.ts` | Allowed MIME types, extensions, max file size, MIME→extension map |
| `src/media/storage/storage.provider.ts` | Abstract `StorageProvider` (interface) |
| `src/media/storage/local-storage.provider.ts` | `LocalStorageProvider` — filesystem implementation |
| `src/media/media.service.ts` | `MediaService` — upload, list, get, soft-delete with audit |
| `src/media/media-folder.service.ts` | `MediaFolderService` — create and list nested folders |
| `src/media/media.controller.ts` | `MediaController` — REST endpoints at `/media` |
| `src/media/media.module.ts` | `MediaModule` — DI wiring; StorageProvider factory |
| `src/media/dto/create-folder.dto.ts` | `CreateFolderDto` |
| `src/media/dto/list-media.dto.ts` | `ListMediaDto`, `ListFoldersDto` |
| `src/common/filters/multer-exception.filter.ts` | Converts `MulterError` → clean 400 JSON response |
| `src/main.ts` | `NestExpressApplication`, static asset serving at `/uploads`, `MulterExceptionFilter` |
| `src/app.module.ts` | Imports `MediaModule` |
| `package.json` | Added `@types/multer` dev dependency |

### Admin (`apps/admin`)

| File | Change |
|---|---|
| `src/lib/api.ts` | `apiMediaUpload`, `apiMediaList`, `apiMediaDelete`, `apiFoldersList`, `apiFolderCreate` |
| `src/pages/MediaPage.tsx` | Full media library UI: upload, grid preview, folder sidebar, delete |
| `src/App.tsx` | Page navigation (Dashboard / Medya Kütüphanesi); refactored shell |

---

## Architecture

### Upload Flow

```
Client                     API                      Storage             DB
  |                         |                          |                 |
  | POST /media/upload       |                          |                 |
  | (multipart, file field)  |                          |                 |
  |------------------------->|                          |                 |
  |                         | FileInterceptor (multer)  |                 |
  |                         | memoryStorage → Buffer    |                 |
  |                         |                          |                 |
  |                         | MediaService.uploadAsset()|                 |
  |                         |  1. validate MIME type    |                 |
  |                         |  2. validate file size    |                 |
  |                         |  3. validate extension    |                 |
  |                         |  4. check folderId scope  |                 |
  |                         |  5. generate storage key  |                 |
  |                         |------------------------->|                 |
  |                         |  StorageProvider.upload() |                 |
  |                         |  (LocalStorageProvider:   |                 |
  |                         |   write to filesystem)    |                 |
  |                         |<-------------------------|                 |
  |                         |  { key, publicUrl }       |                 |
  |                         |                          | MediaAsset.create|
  |                         |------------------------------------------>|
  |                         |  AuditLogService.logAction('media:upload') |
  |                         |                          |                 |
  |<------------------------|                          |                 |
  | MediaAssetResponse       |                          |                 |
```

### Storage Key Design

```
Storage key: tenants/{tenantId}/media/{yyyy}/{mm}/{uuid}.{ext}

Examples:
  tenants/clx01.../media/2025/06/550e8400-e29b-41d4-a716-446655440000.jpg
  tenants/clx01.../media/2025/06/6ba7b810-9dad-11d1-80b4-00c04fd430c8.webp
```

**Why this structure:**
- Tenant-isolated: no cross-tenant path leakage
- Date-partitioned: avoids flat-folder chaos at scale
- UUID filename: no conflicts, no path traversal, unpredictable
- CDN-migration friendly: change the base URL prefix only

### Public URL (Local)

```
http://localhost:4000/uploads/tenants/{tenantId}/media/{yyyy}/{mm}/{uuid}.{ext}
```

Served by Express static middleware bound to `STORAGE_ROOT` at `/uploads` prefix.

### StorageProvider Abstraction

```typescript
abstract class StorageProvider {
  abstract upload(input: UploadInput): Promise<UploadResult>;
  abstract delete(key: string): Promise<void>;
  abstract getPublicUrl(key: string): string;
}
```

To swap to S3: create `S3StorageProvider extends StorageProvider`, change the factory in `MediaModule` — no changes to `MediaService`.

---

## Prisma Models

### MediaFolder

```prisma
model MediaFolder {
  id        String   @id @default(cuid())
  tenantId  String                         // required — all folders are tenant-scoped
  mallId    String?                        // optional — restrict to specific mall
  parentId  String?                        // nullable → nested folder support
  name      String
  slug      String
  createdBy String
  ...
  @@index([tenantId])
  @@index([tenantId, parentId])
}
```

### MediaAsset

```prisma
model MediaAsset {
  id           String    @id @default(cuid())
  tenantId     String
  mallId       String?
  folderId     String?
  uploadedBy   String
  originalName String    // original filename for display
  fileName     String    // UUID-based filename stored on disk
  mimeType     String
  extension    String
  size         Int       // bytes (max Int ≈ 2GB, sufficient for images)
  width        Int?      // populated by future image analysis worker
  height       Int?
  storageKey   String    @unique  // provider-agnostic relative path
  publicUrl    String             // absolute URL for current provider
  altText      String?
  metadataJson Json?     // extensible metadata bag
  deletedAt    DateTime? // soft delete
  ...
}
```

---

## API Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| `POST` | `/media/upload` | `media:upload` | Upload file (multipart) |
| `GET` | `/media` | `media:read` | List assets (paginated) |
| `GET` | `/media/folders` | `media:read` | List folders |
| `POST` | `/media/folders` | `media:upload` | Create folder |
| `GET` | `/media/:id` | `media:read` | Get single asset |
| `DELETE` | `/media/:id` | `media:delete` | Soft-delete asset |

All endpoints require:
- `Authorization: Bearer <token>`
- `x-tenant-id: <tenantId>` header

Optional: `x-mall-id: <mallId>` to scope to a specific mall.

### Query parameters for `GET /media`

| Param | Type | Description |
|---|---|---|
| `folderId` | string | Filter by folder |
| `mallId` | string | Filter by mall |
| `page` | number | Page number (default: 1) |
| `limit` | number | Page size (default: 40, max: 100) |

### Upload body (multipart/form-data)

| Field | Required | Description |
|---|---|---|
| `file` | ✓ | The file to upload |
| `folderId` | ✗ | Place in folder |
| `altText` | ✗ | Accessibility alt text |

---

## Allowed File Types

| MIME Type | Extension |
|---|---|
| `image/jpeg` | `.jpg`, `.jpeg` |
| `image/png` | `.png` |
| `image/gif` | `.gif` |
| `image/webp` | `.webp` |
| `image/svg+xml` | `.svg` |
| `image/avif` | `.avif` |

Max file size: **20 MB**

---

## Permissions

| Permission | SUPER_ADMIN | TENANT_ADMIN | MALL_MANAGER | CONTENT_EDITOR | REPORT_VIEWER |
|---|---|---|---|---|---|
| `media:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `media:upload` | ✓ | ✓ | ✓ | ✓ | — |
| `media:delete` | ✓ | ✓ | ✓ | — | — |

---

## Audit Events

| Action | Trigger |
|---|---|
| `media:upload` | Successful file upload — logs `fileName`, `mimeType`, `size` |
| `media:delete` | Asset soft-deleted — logs `fileName`, `storageKey` as `before` |

All events include `userId`, `tenantId`, `mallId`, `entityId` (asset ID).

---

## Migration Commands

```bash
# 1. Create the migration (requires running PostgreSQL)
cd apps/api
pnpm db:migrate
# When prompted: enter migration name → "add_media_models"

# OR: apply directly in CI/production
pnpm db:migrate:deploy

# 2. Re-seed permissions and roles
pnpm db:seed
```

---

## Local Development Setup

### `.env` additions

```env
# Storage root for local uploads (default: apps/api/storage)
STORAGE_ROOT=/absolute/path/to/apps/api/storage

# Base URL for generating publicUrl in local dev
API_BASE_URL=http://localhost:4000
```

If not set, defaults are:
- `STORAGE_ROOT` → `{process.cwd()}/storage` (typically `apps/api/storage/`)
- `API_BASE_URL` → `http://localhost:4000`

### Local storage tree

```
apps/api/
  storage/
    tenants/
      clx01abc.../
        media/
          2025/
            06/
              550e8400-uuid.jpg
              6ba7b810-uuid.webp
```

### Run everything

```bash
# From repo root
pnpm dev

# API only
pnpm --filter @modern-cms/api dev

# Admin only
pnpm --filter @modern-cms/admin dev
```

---

## curl Upload Examples

### 1. Login and get token

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@example.com","password":"SuperAdmin123!"}' \
  | jq -r '.accessToken')

TENANT_ID=$(curl -s http://localhost:4000/tenants/my \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.tenants[0].id')
```

### 2. Upload an image

```bash
curl -X POST http://localhost:4000/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -F "file=@/path/to/photo.jpg" \
  -F "altText=Hero banner image"
```

**Expected response:**
```json
{
  "id": "clx...",
  "tenantId": "...",
  "mallId": null,
  "folderId": null,
  "originalName": "photo.jpg",
  "fileName": "550e8400-e29b-41d4-a716-446655440000.jpg",
  "mimeType": "image/jpeg",
  "extension": "jpg",
  "size": 204800,
  "width": null,
  "height": null,
  "storageKey": "tenants/.../media/2025/06/550e8400...jpg",
  "publicUrl": "http://localhost:4000/uploads/tenants/.../media/2025/06/550e8400...jpg",
  "altText": "Hero banner image",
  "createdAt": "2025-06-10T12:00:00.000Z"
}
```

### 3. List assets

```bash
curl http://localhost:4000/media \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"
```

### 4. List assets in a folder

```bash
curl "http://localhost:4000/media?folderId=clx..." \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"
```

### 5. Create a folder

```bash
curl -X POST http://localhost:4000/media/folders \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Hero Banners"}'
```

### 6. Upload to a specific folder

```bash
FOLDER_ID="clx..."
curl -X POST http://localhost:4000/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -F "file=@/path/to/banner.png" \
  -F "folderId=$FOLDER_ID"
```

### 7. Delete an asset

```bash
curl -X DELETE http://localhost:4000/media/clx... \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID"
# → 204 No Content
```

### 8. Upload rejection examples

```bash
# Wrong MIME type → 400
curl -X POST http://localhost:4000/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -F "file=@/path/to/document.pdf"
# → {"success":false,"error":{"code":"BAD_REQUEST","message":"Unsupported file type \"application/pdf\". Allowed: ..."}}

# Missing x-tenant-id → 403
curl -X POST http://localhost:4000/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/image.jpg"
# → {"success":false,"error":{"code":"FORBIDDEN","message":"..."}}

# No auth → 401
curl -X GET http://localhost:4000/media
# → {"success":false,"error":{"code":"UNAUTHORIZED","message":"Unauthorized"}}
```

---

## Audit Log Inspection

```sql
-- Recent media events
SELECT
  al.action,
  al."resourceId" AS asset_id,
  u.email AS actor,
  al.metadata,
  al."createdAt"
FROM "AuditLog" al
LEFT JOIN "User" u ON u.id = al."actorUserId"
WHERE al.action IN ('media:upload', 'media:delete')
ORDER BY al."createdAt" DESC
LIMIT 20;

-- All uploads by a specific tenant
SELECT al.*, u.email
FROM "AuditLog" al
JOIN "User" u ON u.id = al."actorUserId"
WHERE al.action = 'media:upload'
  AND al."tenantId" = '<tenant-id>'
ORDER BY al."createdAt" DESC;
```

---

## Future: S3 / Cloudflare R2 Migration Strategy

To migrate from local storage to S3 or R2:

### Step 1 — Create S3StorageProvider

```typescript
// apps/api/src/media/storage/s3-storage.provider.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { StorageProvider, UploadInput, UploadResult } from './storage.provider';

export class S3StorageProvider extends StorageProvider {
  constructor(private readonly s3: S3Client, private readonly bucket: string, private readonly cdnBase: string) {
    super();
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      Body: input.buffer,
      ContentType: input.mimeType,
    }));
    return { key: input.key, publicUrl: this.getPublicUrl(input.key) };
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  getPublicUrl(key: string): string {
    return `${this.cdnBase}/${key}`;
  }
}
```

### Step 2 — Update MediaModule factory

```typescript
// In media.module.ts, change the provider factory:
{
  provide: StorageProvider,
  useFactory: (config: ConfigService): StorageProvider => {
    const provider = config.get('STORAGE_PROVIDER');
    if (provider === 's3') {
      const s3 = new S3Client({ region: config.get('AWS_REGION') });
      return new S3StorageProvider(s3, config.get('S3_BUCKET'), config.get('CDN_BASE_URL'));
    }
    // default local
    return new LocalStorageProvider({ ... });
  },
  inject: [ConfigService],
}
```

### Step 3 — Migrate existing assets (optional)

Existing `storageKey` values are already provider-agnostic. Upload them to S3 using the same key, update `publicUrl` in the DB:

```sql
UPDATE "MediaAsset"
SET "publicUrl" = REPLACE("publicUrl", 'http://localhost:4000/uploads/', 'https://cdn.example.com/')
WHERE "deletedAt" IS NULL;
```

**MediaService and business logic: zero changes required.**

---

## Using Media in Future CMS Modules

```typescript
// In any future module service (e.g., SliderService):
constructor(private readonly mediaService: MediaService) {}

async createSlide(dto: CreateSlideDto, user: User, tenantId: string) {
  // Validate the referenced media asset belongs to the tenant
  const asset = await this.mediaService.getAsset(dto.mediaId, tenantId);
  // asset.publicUrl is ready to use
  return this.prisma.slide.create({ data: { ..., imageUrl: asset.publicUrl } });
}
```

For a media picker in the admin frontend:
```typescript
// MediaPickerModal component will call:
const { assets } = await apiMediaList(token, tenantId, { folderId });
// User selects → returns MediaAsset.id and MediaAsset.publicUrl
```

---

## Image Width/Height

`width` and `height` columns exist in `MediaAsset` and are currently `null` after upload. They are reserved for a future image analysis worker (Sprint N):

```typescript
// Future: apps/worker receives a job after upload
// Uses `sharp` to read dimensions, then patches the DB record
const metadata = await sharp(buffer).metadata();
await prisma.mediaAsset.update({
  where: { id: assetId },
  data: { width: metadata.width, height: metadata.height },
});
```

No worker is built in Sprint 3 — dimensions stay null and the column is available.

---

## Assumptions

1. **Memory storage for uploads** — files are buffered in-memory before writing to disk. For images (max 20 MB), this is acceptable. For video in future sprints, consider streaming or disk-storage multer mode.
2. **Soft-delete only** — physical file deletion is best-effort after soft-delete. A failed physical delete is logged but does not roll back the soft-delete.
3. **No image resizing in this sprint** — that belongs to a worker pipeline (Sprint N).
4. **`width`/`height` are nullable** — set to `null` after upload; a future worker fills them in.
5. **`storageKey` uniqueness** — enforced at DB level via `@unique`. UUID + timestamp makes collisions statistically impossible.
6. **Folder slug uniqueness** — not enforced at DB level (nullable `parentId` makes SQL unique constraints unreliable). Service generates a slug from the name; duplicates within a parent are allowed in this sprint.
7. **Static file serving** — the NestJS API serves uploaded files at `/uploads/*`. In production, a CDN or object storage serves files directly; this middleware is removed or bypassed.
