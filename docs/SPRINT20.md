# Sprint 20 — Tenant & Location Management

## Overview

Sprint 20 evolves the CMS from a shopping-mall–only platform into a generic multi-location product.
The internal database model is still called **Mall** for backward compatibility, but the **product terminology** everywhere is now **Location / Lokasyon**.

---

## 1. Why Mall → Location?

The platform is no longer limited to shopping malls. It can serve:

| Vertical | LocationType |
|---|---|
| Alışveriş merkezi | `SHOPPING_MALL` |
| Mağaza | `STORE` |
| Market / süpermarket | `MARKET` |
| Otel zinciri | `HOTEL` |
| Hastane | `HOSPITAL` |
| Kampüs | `CAMPUS` |
| Ofis binası | `OFFICE` |
| Restoran | `RESTAURANT` |
| Marina | `MARINA` |
| Konut projesi | `RESIDENCE` |
| Havalimanı | `AIRPORT` |
| Özel | `CUSTOM` |

Renaming the DB table would break dozens of `mallId` foreign keys across all modules. Instead:

- **DB / internal code** keeps `Mall` / `mallId` naming.
- **API product layer** exposes `/locations` endpoints.
- **Admin UI** shows "Lokasyonlar" everywhere.
- **Public API** returns `location` in `site-config`.

The full rename (DB migration `Mall → Location`) is planned for a future sprint once a safe migration window is available.

---

## 2. Backward Compatibility

| What | Status |
|---|---|
| `GET /malls/my` | Preserved — unchanged |
| `mallId` FK across all models | Unchanged |
| Tenant/Mall access guards | Unchanged |
| Public API existing endpoints | Unchanged |
| Analytics, search, scheduling | Unchanged |

---

## 3. Prisma Schema Changes

### New enum: `LocationType`

```prisma
enum LocationType {
  SHOPPING_MALL | STORE | MARKET | HOTEL | HOSPITAL
  CAMPUS | OFFICE | RESTAURANT | MARINA | RESIDENCE
  AIRPORT | CUSTOM
}
```

### Mall model — new fields

| Field | Type | Notes |
|---|---|---|
| `type` | `LocationType` | Default `SHOPPING_MALL` |
| `isPublic` | `Boolean` | Default `true` |
| `legalName` | `String?` | |
| `displayName` | `String?` | Overrides `name` in public UI |
| `shortDescription` | `String?` | |
| `description` | `String?` | |
| `logoMediaId` | `String?` | FK → MediaAsset |
| `coverMediaId` | `String?` | FK → MediaAsset |
| `websiteUrl` | `String?` | |
| `supportEmail` | `String?` | |
| `phone` | `String?` | |
| `addressLine1/2` | `String?` | |
| `city`, `district`, `country`, `postalCode` | `String?` | |
| `latitude`, `longitude` | `Float?` | |
| `timezone` | `String?` | |
| `workingHoursJson` | `Json?` | Free-form working hours |
| `socialLinksJson` | `Json?` | `{instagram: "...", ...}` |
| `metadataJson` | `Json?` | Internal metadata |

### Tenant model — new fields

| Field | Type | Notes |
|---|---|---|
| `legalName` | `String?` | |
| `contactEmail` | `String?` | |
| `contactPhone` | `String?` | |
| `websiteUrl` | `String?` | |
| `billingEmail` | `String?` | |
| `addressJson` | `Json?` | |
| `metadataJson` | `Json?` | |

### Updated enums

- `LocalizedEntityType` → added `LOCATION`
- `SearchIndexEntityType` → added `LOCATION`

---

## 4. API Endpoints

### Tenant Management

| Method | Path | Permission |
|---|---|---|
| `GET` | `/tenants` | `tenant:read` (Super Admin only) |
| `GET` | `/tenants/my` | — (current user's tenants) |
| `GET` | `/tenants/:id` | `tenant:read` |
| `POST` | `/tenants` | `tenant:create` (Super Admin only) |
| `PATCH` | `/tenants/:id` | `tenant:update` (Super Admin only) |
| `PATCH` | `/tenants/:id/status` | `tenant:update` (Super Admin only) |

When a new tenant is created, the following capabilities are automatically enabled:
`cms_core`, `media`, `public_api`, `sliders`, `pages`, `stores`, `events`, `campaigns`

### Location Management

| Method | Path | Permission | Notes |
|---|---|---|---|
| `GET` | `/locations` | `location:read` | Supports `search`, `type`, `status`, `city`, `tenantId` |
| `GET` | `/locations/:id` | `location:read` | |
| `POST` | `/locations` | `location:create` | `tenantId` required in body |
| `PATCH` | `/locations/:id` | `location:update` | |
| `PATCH` | `/locations/:id/status` | `location:update` | `{status: "LIVE"\|"DRAFT"\|...}` |
| `DELETE` | `/locations/:id` | `location:delete` | Soft delete |

### Public API: `/public/site-config` (Enhanced)

Now returns a `location` object when `x-mall-id` is provided:

```json
{
  "tenantId": "...",
  "tenantName": "...",
  "tenantSlug": "...",
  "mallId": "...",
  "mallName": "...",
  "mallSlug": "...",
  "location": {
    "id": "...",
    "type": "SHOPPING_MALL",
    "name": "...",
    "displayName": "...",
    "slug": "...",
    "websiteUrl": null,
    "phone": null,
    "supportEmail": null,
    "logo": { "url": "..." },
    "cover": { "url": "..." },
    "address": {
      "line1": "...", "line2": null,
      "city": "...", "district": null,
      "country": "...", "postalCode": null
    },
    "coordinates": { "latitude": 41.0, "longitude": 28.9 },
    "timezone": "Europe/Istanbul",
    "workingHours": {},
    "socialLinks": {}
  }
}
```

`location` is `null` if no `x-mall-id` is sent or if `isPublic = false`.

---

## 5. Permission Model

### New Permissions

| Code | Description |
|---|---|
| `tenant:create` | Create new tenant (Super Admin only) |
| `tenant:update` | Update tenant / change status (Super Admin only) |
| `tenant:delete` | Delete tenant (Super Admin only) |
| `location:read` | View locations |
| `location:create` | Create new location |
| `location:update` | Update / change status of location |
| `location:delete` | Soft-delete a location |

### Role Assignments

| Role | Tenant perms | Location perms |
|---|---|---|
| SUPER_ADMIN | All | All |
| TENANT_ADMIN | `read`, `update` | All |
| MALL_MANAGER | — | `read` only |
| CONTENT_EDITOR | — | `read` only |
| REPORT_VIEWER | `read` | `read` only |

---

## 6. Admin UI

### New Pages

| Page | Route | Visibility |
|---|---|---|
| TenantsPage | `/tenants` | Super Admin only |
| TenantDetailPage | `/tenants/:id` | Super Admin only |
| LocationsPage | `/locations` | Super Admin + Tenant Admin |
| LocationDetailPage | `/locations/:id` | Super Admin + Tenant Admin |

### Navigation

Added under **Yönetim** group:
- **Müşteriler** (`/tenants`) — `superAdminOnly: true`
- **Lokasyonlar** (`/locations`) — `location:read` permission

### LocationDetailPage Sections

- **Temel Bilgiler** — name, displayName, legalName, slug, type, description, isPublic
- **İletişim** — phone, supportEmail, websiteUrl, timezone
- **Adres** — addressLine1/2, city, district, country, postalCode
- **Konum** — latitude, longitude
- **Çalışma Saatleri** — workingHoursJson (free-form JSON)
- **Sosyal Medya** — socialLinksJson (free-form JSON)

### TenantDetailPage Sections

- Basic info with inline editing (SA only)
- Status management (SA only)
- Locations list (links to LocationDetailPage)
- Capabilities summary

---

## 7. Role Editing & Permission UX Improvements

### RoleDetailPage Improvements

- **Editable fields**: name, description, active/inactive toggle
- **Immutable role code**: role code is displayed but cannot be changed
- **Save/Cancel UX**: changes tracked locally, save button only appears when dirty
- **System role editing**: system roles show the warning badge “Sistem rolü — sadece Super Admin düzenleyebilir”
- **Super Admin system role access**: Super Admin can edit system role name, description, active state, and permission matrix when safe
- **Tenant-owned custom roles**: Tenant Admin can edit only tenant-owned custom roles, never system roles or global custom roles

### Role Management Rules

- `SUPER_ADMIN` can edit permissions of system roles.
- `SUPER_ADMIN` can edit system role name, description, and `isActive` when the change is safe.
- `code` is immutable for every role.
- The `SUPER_ADMIN` role itself cannot be deleted.
- System roles cannot be deleted; unused system roles may be deactivated when no active users depend on them.
- Critical platform permissions cannot be removed from the last effective `SUPER_ADMIN` role.
- `TENANT_ADMIN` can only edit tenant-owned custom roles.

Migrations verified from a clean database.

### Permission Matrix

Permissions are now displayed in **17 semantic groups**:

| Group | Key permissions |
|---|---|
| Genel Yönetim | content:*, settings:*, search:global |
| Kullanıcı Yönetimi | user:* |
| Rol ve Yetki Yönetimi | role:* |
| Müşteri Yönetimi | tenant:* |
| Lokasyon Yönetimi | location:*, mall:* |
| Medya Yönetimi | media:* |
| Slider Yönetimi | slider:* |
| Sayfa Yönetimi | page:*, page-block:* |
| Etkinlik Yönetimi | event:* |
| Kampanya Yönetimi | campaign:* |
| Mağaza Yönetimi | store-category:*, global-store:*, mall-store:* |
| Sinema Yönetimi | cinema:*, movie:*, movie-session:* |
| Analitik / Raporlama | analytics:* |
| Bildirimler | notification:* |
| Dil / Çeviri Yönetimi | locale:*, translation:* |
| Sistem / Operasyon | capability:* |
| Diğer | Everything else |

### Human-Readable Permission Labels

Every permission code has a Turkish label. Examples:

| Code | Label |
|---|---|
| `user:create` | Kullanıcı oluştur |
| `campaign:publish` | Kampanya yayınla |
| `location:create` | Lokasyon oluştur |
| `mall:switch` | Lokasyon değiştir |

### Permission Search & Filter

- Search by permission **code** (e.g. `location:update`)
- Search by **Turkish label** (e.g. "yayınla")
- Filter by group/module via dropdown

---

## 8. Future: Full Rename Plan (Mall → Location)

When the time comes to rename the DB table:

1. Create a new migration that renames `Mall` → `Location` and all FK columns from `mallId` → `locationId`.
2. Update all Prisma relations and service files.
3. Keep `/malls/my` as a deprecated alias for 1 sprint.
4. Remove the alias in the following sprint.
5. Update `mallId` in `AuditLog`, `SearchIndexEntry`, `AnalyticsEvent`, etc.

This work is estimated at ~2 days and requires a maintenance window.

---

## 9. Migration & Seed Commands

```bash
# Migration (already applied)
npx prisma migrate dev --name sprint20_location_tenant_fields

# Seed (run to add new permissions and update roles)
npx prisma db seed

# Or with pnpm workspace
pnpm --filter api db:seed
```

---

## 10. Assumptions Made

1. `logoMediaId` / `coverMediaId` on Mall point to existing `MediaAsset` records — no new upload UI in this sprint; media picker follows the pattern from other modules.
2. Working hours and social links are stored as free-form JSON for now. A structured editor can be added in a future sprint.
3. Tenant creation is Super Admin only at the API level (service-layer guard, not just permission guard).
4. Soft-delete (`deletedAt`) is used for locations; tenants are deactivated via status change only.
5. The `LOCATION` enum value added to `LocalizedEntityType` and `SearchIndexEntityType` is available for future localization and search indexing of locations.
