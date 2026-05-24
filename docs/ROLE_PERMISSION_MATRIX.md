# Role & Permission Matrix

> Last updated: Sprint 25 (Role & Permission Hardening)

---

## 1. Role Overview

| Role | Type | Scope | Description |
|------|------|-------|-------------|
| `SUPER_ADMIN` | System / Platform | Platform-wide | Full platform access. Manages tenants, capabilities, global stores, all users/roles, all settings, audit/security logs. |
| `TENANT_ADMIN` | System / Tenant | Own tenant | Manages own tenant — users, roles, locations, content, media, localization, settings. Cannot mutate global store master data. |
| `MALL_MANAGER` | System / Tenant | Assigned mall/location | Manages content for assigned mall/location. Can manage mall stores, events, campaigns, sliders, popups, services. Cannot manage tenant users/roles globally. |
| `CONTENT_EDITOR` | System / Tenant | Assigned mall/location | Content create/update. No destructive ops on critical entities. Can manage translations and media uploads. |
| `REPORT_VIEWER` | System / Tenant | Tenant | Read-only analytics and reporting. No create/update/delete. |

Custom roles can be created per-tenant by TENANT_ADMIN or SUPER_ADMIN, inheriting any subset of permissions.

---

## 2. Tenant / Mall Context Rules

### Login Flow

```
Login
  └─ SUPER_ADMIN?
        ├─ YES → /select-tenant (always, even if one tenant)
        └─ NO
              └─ 1 tenant? → auto-select → check malls
                   └─ 1 mall? → auto-select → /dashboard
                   └─ N malls? → /select-location
              └─ N tenants? → /select-tenant
```

### Tenant Change
- Changing active tenant clears the active mall/location.
- If the new tenant has exactly one mall, it is auto-selected (header hides “— tümü —”).
- If the new tenant has multiple malls, user is prompted at `/select-location`.

### Invalid Context
- If the stored mall/location is invalid for the active tenant, it is cleared and re-selected when only one mall exists.
- ProtectedRoute enforces: no `activeTenantId` → redirect to `/select-tenant`.
- ProtectedRoute enforces: `activeTenantId` + `malls.length > 1` + no `activeMallId` → redirect to `/select-location`.

### Helper Messages (Turkish)
| Condition | Message |
|-----------|---------|
| No tenant selected | "Müşteri seçmelisiniz." |
| No location selected | "Lokasyon seçmelisiniz." |
| No permission for page | "Bu sayfa için yetkiniz yok." (403 page) |

---

## 3. Global Store Ownership Decision — Option A

**Decision: Global stores are platform-level brand master data.**

| Operation | Who |
|-----------|-----|
| Create global store | SUPER_ADMIN only |
| Update global store | SUPER_ADMIN only |
| Delete global store | SUPER_ADMIN only |
| Read global stores | Any role with `global-store:read` |
| Assign global store → mall store | Any role with `mall-store:assign` |
| Update mall store instance | Any role with `mall-store:update` |

**Rationale:**
Global stores represent the canonical brand catalog shared across all tenants/locations (e.g., Zara, H&M). Allowing tenant admins to mutate global store master data would corrupt the shared catalog. Tenant-specific details (floor, phone, hours) live in `MallStore`, which each tenant manages independently.

**Backend enforcement:** `GlobalStoresController` checks `user.isSuperAdmin` for POST/PATCH/DELETE in addition to the permission guard. Even if a non-SA user somehow had `global-store:create` permission, the controller rejects the request.

**Frontend enforcement:** `GlobalStoresPage` hides create/edit/delete buttons for non-Super Admin users and shows a "read-only" notice.

---

## 4. Route Visibility Rules

### Capability vs Permission

- **Capability**: A feature module enabled per-tenant (e.g., `sliders`, `cinema`, `stores`). Controlled by SUPER_ADMIN via Capabilities page. Tenants with the capability enabled see the module.
- **Permission**: An action a user can perform within a module (e.g., `slider:create`, `event:delete`). Assigned per-role.

A user needs **both** the capability enabled for their tenant **and** the required permission in their role to access a page.

### Page Visibility by Role

| Page | Permission | Capability | SUPER_ADMIN | TENANT_ADMIN | MALL_MANAGER | CONTENT_EDITOR | REPORT_VIEWER |
|------|-----------|-----------|:-----------:|:------------:|:------------:|:--------------:|:-------------:|
| Dashboard | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Analytics | `analytics:view` | `analytics` | ✓ | ✓ | ✓ | ✗ | ✓ |
| Notifications | `notification:read` | `notifications` | ✓ | ✓ | ✓ | ✓ | ✗ |
| Search | `search:global` | `search` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Media | `media:read` | `media` | ✓ | ✓ | ✓ | ✓ | ✗ |
| Media Guidelines | `media:read` | `media` | ✓ | ✓ | ✓ | ✓ | ✗ |
| Sliders | `slider:read` | `sliders` | ✓ | ✓ | ✓ | ✓ | ✗ |
| Events | `event:read` | `events` | ✓ | ✓ | ✓ | ✓ | ✗ |
| Campaigns | `campaign:read` | `campaigns` | ✓ | ✓ | ✓ | ✓ | ✗ |
| Popups | `popup:read` | `popups` | ✓ | ✓ | ✓ | ✓ | ✗ |
| Services | `service:read` | `location_services` | ✓ | ✓ | ✓ | ✓ | ✗ |
| Pages | `page:read` | `pages` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cinemas | `cinema:read` | `cinema` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Movies | `movie:read` | `cinema` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sessions | `movie-session:read` | `cinema` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Store Categories | `store-category:read` | `stores` | ✓ | ✓ | ✗ | ✓ | ✓ |
| Global Stores | `global-store:read` | `stores` | ✓ | ✓ | ✗ | ✓ | ✓ |
| Mall Stores | `mall-store:read` | `stores` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Capabilities | `capability:read` + SA | — | ✓ | ✗ | ✗ | ✗ | ✗ |
| Audit Logs | `audit:read` | — | ✓ | ✓ | ✗ | ✗ | ✗ |
| Tenants | `tenant:read` + SA | — | ✓ | ✗ | ✗ | ✗ | ✗ |
| Locations | `location:read` | — | ✓ | ✓ | ✗ | ✗ | ✓ |
| Users | `user:read` | — | ✓ | ✓ | ✗ | ✗ | ✗ |
| Roles | `role:read` | — | ✓ | ✓ | ✗ | ✗ | ✗ |
| Settings General | `settings:read` | — | ✓ | ✓ | ✗ | ✗ | ✗ |
| Settings Security | `settings:read` | — | ✓ | ✓ | ✗ | ✗ | ✗ |
| Localization | `locale:read` | `localization` | ✓ | ✓ | ✓ | ✓ | ✗ |
| Account | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |

**Note:** Route-level `PermissionGate` component enforces access — direct URL access returns a 403 page if the user lacks permission/capability.

---

## 5. Permission Matrix by Role

### 5.1 SUPER_ADMIN
Gets all permissions in the system. Key exclusive permissions:
- `tenant:create`, `tenant:delete`
- `global-store:create`, `global-store:update`, `global-store:delete`
- `capability:update`
- `audit:security`, `audit:export`

### 5.2 TENANT_ADMIN
Gets all permissions **except**:
- `tenant:create`, `tenant:delete` (platform-level)
- `global-store:create`, `global-store:update`, `global-store:delete` (Option A ownership)
- `audit:security`, `audit:export` (security-sensitive)
- `capability:update` (platform-level; gets `capability:read`)

### 5.3 MALL_MANAGER
Content management for assigned mall/location only:

| Area | Permissions |
|------|------------|
| Mall context | `mall:read`, `mall:switch` |
| Analytics | `analytics:view` |
| Media | `media:read`, `media:upload`, `media:update`, `media:delete`, `media:manage-folders` |
| Sliders | `slider:read/create/update/delete/publish/reorder` |
| Events | `event:read/create/update/delete/publish/archive` |
| Campaigns | `campaign:read/create/update/delete/publish/archive` |
| Popups | `popup:read/create/update/delete/publish` |
| Services | `service:read/create/update/delete` |
| Pages | `page:read/create/update/publish/archive`, `page-block:*` |
| Cinema | `cinema:read/create/update/delete`, `movie:read/create/update`, `movie-session:*` |
| Mall stores | `mall-store:read/assign/update/feature` |
| Localization | `locale:read`, `translation:read/create/update` |
| Notifications | `notification:read/update` |
| Search | `search:global` |

**Cannot**: manage tenants, capabilities, locations list, users/roles, tenant settings, audit logs, global store catalog, or store categories. Single-mall tenants auto-select that mall in the header (no “— tümü —”).

### 5.4 CONTENT_EDITOR
Focused on content creation and editing:

| Area | Permissions |
|------|------------|
| Content | `content:read/create/update` |
| Media | `media:read`, `media:upload`, `media:update` |
| Sliders | `slider:read/create/update` |
| Events | `event:read/create/update` |
| Campaigns | `campaign:read/create/update` |
| Popups | `popup:read/create/update` |
| Services | `service:read/create/update` |
| Pages | `page:read/create/update`, `page-block:read/create/update/reorder` |
| Cinema | `cinema:read/create/update`, `movie:read/create/update`, `movie-session:read/create/update` |
| Stores | `store-category:read`, `global-store:read`, `mall-store:read/update` |
| Localization | `locale:read`, `translation:read/create/update` |
| Notifications | `notification:read/update` |
| Search | `search:global` |
| Users | `user:read` |

**Cannot**: delete, publish, archive, manage roles/users/tenants/settings/capabilities.

### 5.5 REPORT_VIEWER
Read-only analytics and data access:

| Area | Permissions |
|------|------------|
| Tenants/Locations | `tenant:read`, `mall:read`, `location:read` |
| Analytics | `analytics:view`, `analytics:export` |
| Content (read) | `media:read`, `slider:read`, `event:read`, `campaign:read`, `cinema:read`, `movie:read`, `movie-session:read`, `page:read`, `page-block:read` |
| Stores (read) | `store-category:read`, `global-store:read`, `mall-store:read` |
| Search | `search:global` |
| Notifications | `notification:read`, `notification:update` |

**Cannot**: create, update, delete anything. No settings, roles, users, capabilities.

---

## 6. Dangerous Permissions

The following permissions are marked with a ⚠ warning indicator in the Role UI:

| Permission | Risk |
|------------|------|
| `role:update` | Can grant any permission to any role |
| `role:delete` | Can remove access control infrastructure |
| `user:delete` | Irreversible user removal |
| `tenant:delete` | Irreversible tenant removal |
| `capability:update` | Controls what modules tenants can access |
| `audit:security` | Access to security-sensitive audit trail |
| `audit:export` | Can export all audit data |
| `location:delete` | Irreversible location removal |
| `settings:update` | Can change platform-wide configuration |

**Critical guard:** The SUPER_ADMIN system role cannot have its critical platform permissions removed (enforced in `RolesService.assertSuperAdminCriticalPermissions`).

---

## 7. Backend Guard Architecture

### Guard Stack (per request)
1. `JwtAuthGuard` — validates JWT, loads user
2. `TenantAccessGuard` — if `@RequireTenantContext()`, validates `x-tenant-id` header and user membership
3. `MallAccessGuard` — if `@RequireMallContext()`, validates `x-mall-id` against user's mall access
4. `PermissionsGuard` — if `@RequirePermission(...)`, checks user's effective permissions for the tenant

### Super Admin Bypass
- `TenantAccessGuard`: SA passes if tenant exists (no membership required)
- `MallAccessGuard`: SA passes if mall belongs to tenant
- `PermissionsGuard`: SA always passes
- `GlobalStoresController`: explicit `isSuperAdmin` check for write operations

### Effective Permissions
For non-SA users, `AccessService.getEffectivePermissionCodes(user, tenantId)` reads permissions from the user's role → `TenantUser.roleId → Role.rolePermissions → Permission.code`.

---

## 8. Examples

### Example: SUPER_ADMIN
- Logs in → `/select-tenant` (forced, no auto-select)
- Selects Mall Group → `/select-location` → selects Mall of İstanbul
- Can see ALL sidebar items including Tenants, Capabilities
- Can create/edit/delete Global Stores
- Can update SUPER_ADMIN role permissions
- Can export audit logs and view security events

### Example: TENANT_ADMIN (Mall Group)
- Logs in → auto-selected to Mall Group (only tenant)
- If Mall Group has 1 mall → auto-selected; if multiple → `/select-location`
- Sees: all content pages, media, users, roles, locations, settings, localization, audit logs
- Does NOT see: Tenants page, Capabilities page
- Can read Global Stores but cannot create/update/delete them
- Can manage custom roles within Mall Group (cannot edit system roles)

### Example: MALL_MANAGER (Mall of İstanbul)
- Logs in → auto-selected to Mall Group → auto-selected/forced to Mall of İstanbul
- Header shows role name (e.g. “Mall Manager”) under the user display name
- Sees: content pages (events, campaigns, sliders, popups, services, etc.), media, mall stores, localization
- Does NOT see: Tenants, Capabilities, Locations, Users, Roles, Settings, Audit Logs, Global Stores, Store Categories
- Cannot: manage other malls' content, tenant admin pages, or platform-level catalog/settings

### Example: CONTENT_EDITOR
- Logs in → auto-selected tenant → mall selection if multiple
- Sees: media, sliders, events, campaigns, popups, services, pages, cinemas, movies, localization
- Does NOT see: Analytics, Roles, Users management, Settings, Audit Logs, Tenants, Capabilities
- Can create and update content but not publish, delete, or archive

### Example: REPORT_VIEWER
- Logs in → auto-selected tenant
- Sees: Analytics, Pages (read), Cinemas/Movies (read), Global Stores (read)
- Does NOT see: Media Library, Sliders edit, Events edit, Campaigns edit, Roles, Users, Settings, Audit Logs
- Cannot: modify anything

---

## 9. Role Management UX

| Action | Who |
|--------|-----|
| View system role details | Anyone with `role:read` |
| Edit system role | SUPER_ADMIN only |
| Edit custom tenant role | TENANT_ADMIN (own tenant) or SUPER_ADMIN |
| Create custom role | Anyone with `role:create` |
| Delete custom role | Anyone with `role:delete` (own tenant scope) |
| Clone role | Anyone with `role:create` |
| View permission matrix | Anyone with `role:read` |
| Modify permissions | SUPER_ADMIN (any), TENANT_ADMIN (own tenant custom roles) |

### UI Indicators
- **Sistem / Özel** badge: identifies if a role is a system or custom role
- **Platform / Tenant** badge: identifies role scope
- **⚠ Tehlikeli yetki**: marks permissions with system-wide impact (red border on chip)
- **Düzenlenemez** notice: system roles show warning that only Super Admin can edit

---

## 10. Localization Notes (Turkish UI)

| Situation | Turkish Message |
|-----------|----------------|
| No tenant selected | "Müşteri seçmelisiniz." |
| No location selected | "Lokasyon seçmelisiniz." |
| Page access denied | "Bu sayfa için yetkiniz yok." |
| Global store read-only notice | "Salt okunur — Global mağaza yönetimi yalnızca Super Admin yetkisine sahiptir" |
| Dangerous permission tooltip | "Tehlikeli yetki — dikkatli kullanın" |
| System role notice | "Sistem rolü — sadece Super Admin düzenleyebilir" |
