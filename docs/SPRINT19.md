# Sprint 19 — User, Role & Permission Management

## Overview

Sprint 19 turns the CMS into a fully manageable multi-tenant admin platform. It adds complete user administration, role management, permission visibility, a settings foundation, a personal account page, and expanded audit coverage — all while preserving the existing RBAC architecture and multi-tenant isolation.

---

## RBAC Architecture

### Principal Hierarchy

```
SuperAdmin (isSuperAdmin=true on User)
  └─ Platform-level: sees all tenants, all malls, all users
  └─ No TenantUser record required

TenantUser (User + Tenant + Role)
  └─ TenantAdmin: full tenant access, can manage users/roles in their tenant
  └─ MallManager: restricted to assigned malls
  └─ ContentEditor: content creation/update only
  └─ ReportViewer: read-only analytics
  └─ [Custom Roles]: tenant-created, tenant-scoped
```

### Permission Resolution

1. `JwtAuthGuard` validates Bearer token and injects `User` into request.
2. `PermissionsGuard` calls `AccessService.getEffectivePermissionCodes(user, tenantId)`.
3. Super Admin → all permissions in DB.
4. Regular user → permissions from their `TenantUser.role.rolePermissions`.
5. Tenant context comes from `x-tenant-id` header (set by `TenantContextMiddleware`).

### Isolation Rules

| Actor | Scope |
|-------|-------|
| Super Admin | All tenants, all malls, all resources |
| Tenant Admin | Own tenant only, all malls within tenant |
| Mall Manager | Own tenant, assigned malls only |
| Content Editor | Own tenant, assigned malls only |
| Report Viewer | Read-only, own tenant |

---

## Membership Model

### Schema

```
User (1) ──── (N) TenantUser (N) ──── (N) UserMallAccess
                      │
                      └── roleId → Role
```

### TenantUser Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | cuid | Primary key |
| `tenantId` | String | Tenant reference |
| `userId` | String | User reference |
| `roleId` | String | Role reference |
| `isActive` | Boolean | Soft deactivate without removal |
| `deletedAt` | DateTime? | Soft delete |

### Key Behaviours

- A user may have TenantUser records in **multiple tenants** (multi-membership).
- `deletedAt != null` = membership removed (soft delete).
- `isActive = false` = membership temporarily suspended.
- Mall access is explicit via `UserMallAccess` records.
- `SUPER_ADMIN` and `TENANT_ADMIN` roles implicitly access all malls (no `UserMallAccess` rows needed — enforced in `AccessService`).

---

## Mall Access Model

### Schema

```
UserMallAccess {
  tenantUserId → TenantUser
  mallId       → Mall
  @@unique([tenantUserId, mallId])
}
```

### Isolation

- Mall IDs are always validated against `tenantId` at the service layer before assignment.
- A Tenant Admin cannot assign malls outside their tenant.
- Super Admin bypasses all mall restrictions.
- Mall Manager visibility is limited to rows in `UserMallAccess`.

---

## Role Model

### System vs Custom Roles

| Property | System Role | Custom Role |
|----------|-------------|-------------|
| `isSystem` | `true` | `false` |
| `tenantId` | `null` | `<tenantId>` |
| Deletable | No | Yes (if not in use) |
| Permissions editable | No | Yes |
| Created by | Seed/migration | Admin UI |

### Custom Role Code Format

Custom roles receive a deterministic unique code at creation:

```
tenant_<tenantId[-6:]>_<nameslug>_<timestamp36>
```

Example: `tenant_abc123_editors_lz3b4a`

### Permission Groups

Permissions are grouped for the UI matrix:

| Group | Sample Permissions |
|-------|--------------------|
| media | media:read, media:upload, media:delete |
| sliders | slider:read, slider:create … slider:publish |
| events | event:read … event:archive |
| campaigns | campaign:read … campaign:archive |
| stores | store-category:*, global-store:*, mall-store:* |
| pages | page:*, page-block:* |
| analytics | analytics:view, analytics:export |
| notifications | notification:read, notification:update, notification:delete |
| localization | locale:*, translation:* |
| search | search:global |
| users | user:read, user:create, user:update, user:delete |
| roles | role:read, role:create, role:update, role:delete |
| settings | settings:read, settings:update |
| capabilities | capability:read, capability:update |
| tenants | tenant:read, mall:read, mall:switch |

---

## Settings Structure

Settings are stored as JSON blobs in `TenantSetting`:

```
TenantSetting {
  tenantId  String
  key       String   ("general" | "security")
  value     Json
  @@unique([tenantId, key])
}
```

### General Settings Keys

| Key | Default | Description |
|-----|---------|-------------|
| `displayName` | "" | Visible tenant name |
| `timezone` | "Europe/Istanbul" | IANA timezone string |
| `defaultLocale` | "tr" | ISO 639-1 locale code |
| `supportEmail` | "" | Contact email |
| `logoUrl` | "" | Logo asset URL placeholder |

### Security Settings Keys

| Key | Default | Description |
|-----|---------|-------------|
| `sessionTimeoutMinutes` | 60 | JWT expiry hint (5–1440) |
| `allowPublicRegistration` | false | Open signup flag |
| `maintenanceMode` | false | Disables public API (future) |
| `passwordPolicy` | "default" | Policy slug (placeholder) |

---

## New Permissions

| Permission | Assigned To |
|------------|-------------|
| `user:update` | SUPER_ADMIN, TENANT_ADMIN |
| `user:delete` | SUPER_ADMIN, TENANT_ADMIN |
| `role:create` | SUPER_ADMIN, TENANT_ADMIN |
| `role:update` | SUPER_ADMIN, TENANT_ADMIN |
| `role:delete` | SUPER_ADMIN, TENANT_ADMIN |
| `settings:read` | SUPER_ADMIN, TENANT_ADMIN, MALL_MANAGER |
| `settings:update` | SUPER_ADMIN, TENANT_ADMIN |

---

## New API Endpoints

### Users (`/users`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/users` | user:read |
| GET | `/users/:id` | user:read |
| POST | `/users` | user:create |
| PATCH | `/users/:id` | user:update |
| PATCH | `/users/:id/status` | user:update |
| POST | `/users/:id/memberships` | user:create |
| PATCH | `/users/:id/memberships/:mid` | user:update |
| DELETE | `/users/:id/memberships/:mid` | user:delete |
| POST | `/users/:id/reset-password` | user:update |

### Roles (`/roles`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/roles` | role:read |
| GET | `/roles/permissions` | role:read |
| GET | `/roles/:id` | role:read |
| POST | `/roles` | role:create |
| PATCH | `/roles/:id` | role:update |
| PATCH | `/roles/:id/permissions` | role:update |
| POST | `/roles/:id/clone` | role:create |
| DELETE | `/roles/:id` | role:delete |

### Settings (`/tenants/:tenantId/settings`)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/tenants/:id/settings` | settings:read |
| PATCH | `/tenants/:id/settings/general` | settings:update |
| PATCH | `/tenants/:id/settings/security` | settings:update |

### Auth / Account

| Method | Path | Auth |
|--------|------|------|
| PATCH | `/auth/me` | Bearer |
| POST | `/auth/change-password` | Bearer |

---

## Admin UI Routes

| Route | Component | Permission |
|-------|-----------|------------|
| `/users` | UsersPage | user:read |
| `/users/:id` | UserDetailPage | user:read |
| `/roles` | RolesPage | role:read |
| `/roles/:id` | RoleDetailPage | role:read |
| `/settings/general` | SettingsGeneralPage | settings:read |
| `/settings/security` | SettingsSecurityPage | settings:read |
| `/account` | AccountPage | (any logged-in user) |

---

## Migration Summary

Migration: `20260514185541_sprint19_users_roles_settings`

Changes:
- `Role`: added `tenantId String?`, `isActive Boolean @default(true)`, relation to `Tenant`
- `TenantUser`: added `isActive Boolean @default(true)`
- `Tenant`: added reverse relations `roles[]` and `settings[]`
- New model: `TenantSetting` (`id`, `tenantId`, `key`, `value Json`, timestamps, `@@unique([tenantId, key])`)

---

## Audit Coverage (New Actions)

| Action | Trigger |
|--------|---------|
| `user_created` | POST /users |
| `user_updated` | PATCH /users/:id |
| `user_activated` | PATCH /users/:id/status → ACTIVE |
| `user_deactivated` | PATCH /users/:id/status → DISABLED |
| `password_reset_requested` | POST /users/:id/reset-password |
| `membership_created` | POST /users/:id/memberships |
| `membership_updated` | PATCH /users/:id/memberships/:mid |
| `membership_removed` | DELETE /users/:id/memberships/:mid |
| `role_created` | POST /roles |
| `role_updated` | PATCH /roles/:id |
| `role_permissions_updated` | PATCH /roles/:id/permissions |
| `role_cloned` | POST /roles/:id/clone |
| `role_deleted` | DELETE /roles/:id |
| `settings_updated` | PATCH /tenants/:id/settings/* |
| `profile_updated` | PATCH /auth/me |
| `password_changed` | POST /auth/change-password |

---

## Assumptions

1. **Custom roles are tenant-scoped.** Super Admins can create global custom roles (tenantId=null) but this use case is rare; the UI prompts tenant context for non-superadmin actors.

2. **Role deletion requires zero active memberships.** Rather than cascading or reassigning, the API returns a 400 with a usage count so the admin can migrate users first.

3. **Password reset is a placeholder.** The endpoint creates an audit log entry and returns a token placeholder. Real email delivery is deferred to a future sprint.

4. **Settings are per-tenant, not per-mall.** Mall-level configuration can be layered on top in a future sprint if needed.

5. **Maintenance mode** is stored in security settings but does not yet affect public API routing — the `PublicModule` will check this flag when CDP delivery is implemented.

---

## Future Compatibility Notes

### SSO / OAuth

- The `User` model has no `provider` field yet. Add `provider String?` and `providerAccountId String?` before implementing OAuth.
- Memberships are independent of the auth provider, so the membership model needs no changes for SSO.

### Invite Email

- The `POST /users` endpoint creates a user with status `ACTIVE`. For an invite flow:
  1. Create user with `status: INVITED`, generate a signed invite token.
  2. Email the token link (requires an email service module).
  3. User follows link → verifies token → sets password → status → `ACTIVE`.
- The `UserStatus.INVITED` enum value is already in the schema, ready for this flow.

### Permission Inheritance

- Currently permissions are flat on the role (no inheritance/hierarchy).
- A future `parentRoleId` field on `Role` could enable inheritance (child roles inherit parent permissions with optional additions/exclusions).

### Capability Gating

- User/role/settings management is intentionally **not** capability-gated (CMS core functionality).
- If future plans require white-labelling these features, add `capability: 'rbac_management'` to the nav items and a corresponding `TenantCapability` check.
