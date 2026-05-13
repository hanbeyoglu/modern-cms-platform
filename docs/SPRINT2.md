# Sprint 2 — Security Hardening, Permission System & Audit Foundation

## Goal

Before building CMS business modules, this sprint establishes a production-grade authorization and audit architecture that every future module will reuse.

---

## What Changed

### API (`apps/api`)

| File | Change |
|---|---|
| `src/common/metadata-keys.ts` | Added `AUDIT_ACTION_KEY` constant |
| `src/common/decorators/require-permission.decorator.ts` | New `@RequirePermission(...permissions)` decorator |
| `src/common/decorators/audit-action.decorator.ts` | New `@AuditAction(action)` decorator |
| `src/common/filters/http-exception.filter.ts` | Global `HttpExceptionFilter` — standardized error envelope |
| `src/audit/audit.service.ts` | `AuditLogService.logAction()` — central write path for audit records |
| `src/audit/audit.interceptor.ts` | `AuditInterceptor` — global interceptor, activates on `@AuditAction` |
| `src/audit/audit.module.ts` | `AuditModule` — registers service + global interceptor |
| `src/access/access.controller.ts` | Debug endpoints `/access/debug/me|analytics|content-publish` |
| `src/access/access.module.ts` | Added `AccessController` |
| `src/auth/auth.service.ts` | `login_success` / `login_failed` audit events |
| `src/auth/auth.module.ts` | Imports `AuditModule` |
| `src/app.module.ts` | Imports `AuditModule` |
| `src/main.ts` | Registers `HttpExceptionFilter` globally |

### Admin (`apps/admin`)

| File | Change |
|---|---|
| `src/lib/api.ts` | Full typed client: `apiLogin`, `apiMe`, `apiTenants`, `apiMalls` |
| `src/auth/auth-context.ts` | Extended state: user profile, tenants, malls, activeTenantId, activeMallId |
| `src/auth/AuthProvider.tsx` | Auto-fetches `/auth/me` + `/tenants/my` on token load; auto-fetches `/malls/my` on tenant select |
| `src/components/TenantMallSelector.tsx` | Dropdown selectors for tenant and mall |
| `src/App.tsx` | Authenticated shell showing user profile, tenants, malls, context |

---

## Architecture

### Auth Flow

```
POST /auth/login
  → validate credentials (bcrypt)
  → on failure: write audit(login_failed) → 401
  → on success: issue access + refresh tokens → write audit(login_success) → 200

Bearer token on every protected request
  → JwtAuthGuard (global, via APP_GUARD)
  → Passport JWT strategy validates token, loads user from DB
  → user attached to req.user

GET /auth/me
  → returns user profile + tenants + memberships
```

### Permission Flow

```
@RequirePermission('content:publish')
@UseGuards(PermissionsGuard)
async handler() { ... }

PermissionsGuard:
  1. Skip if @Public()
  2. Skip if no permissions metadata
  3. superAdmin → always pass
  4. Read tenantId from req.tenantId (set by TenantContextMiddleware from x-tenant-id header)
  5. Load role → RolePermissions from DB
  6. Check every required permission code is present
  7. Missing → 403 FORBIDDEN
```

### Mall Access Behavior

| User Role | x-tenant-id behavior | x-mall-id behavior |
|---|---|---|
| **SUPER_ADMIN** | Always passes (tenant must exist) | Always passes (mall must exist in tenant) |
| **TENANT_ADMIN** | Must be member of tenant | Access to ALL malls in that tenant |
| **MALL_MANAGER** | Must be member of tenant | Access only to explicitly assigned malls |
| **CONTENT_EDITOR** | Must be member of tenant | Access only to explicitly assigned malls |
| **Unauthorized** | 403 | 403 |

Changing headers manually does not grant access — every request validates against the database.

### Audit Flow

```
AuditLogService.logAction({
  userId, tenantId, mallId,
  action, entityType, entityId,
  before, after,
  ip, userAgent
})
  → writes to AuditLog table
  → before/after/ip/userAgent stored in metadata JSON
  → errors are caught + logged — never crash the application

Automatic audit via @AuditAction decorator:
  @AuditAction('content:create')
  → AuditInterceptor fires on successful response
  → logs action with request context (user, tenantId, mallId, ip, userAgent)

Manual audit (auth events, sensitive operations):
  await this.audit.logAction({ ... })
```

---

## Error Response Format

All HTTP errors now return a consistent JSON envelope:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Eksik yetki: content:publish"
  }
}
```

| HTTP Status | code |
|---|---|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 422 | `UNPROCESSABLE_ENTITY` |

---

## Migration Commands

No schema changes were made in Sprint 2. The `AuditLog` model from Sprint 1 is used as-is (`metadata` JSON stores `before`, `after`, `ip`, `userAgent`).

```bash
# Apply any pending migrations (none new in Sprint 2)
cd apps/api && pnpm db:migrate:deploy
```

---

## Seed Commands

```bash
cd apps/api && pnpm db:seed
```

Seeded users:

| Email | Password | Role | Access |
|---|---|---|---|
| `superadmin@example.com` | `SuperAdmin123!` | SUPER_ADMIN | All tenants + malls |
| `groupadmin@example.com` | `GroupAdmin123!` | TENANT_ADMIN | Mall Group tenant (all malls) |
| `mallmanager@example.com` | `MallManager123!` | MALL_MANAGER | Mall Group → Mall of İstanbul only |

---

## How to Run

```bash
# API (from repo root)
pnpm --filter @modern-cms/api dev

# Admin UI (from repo root)
pnpm --filter @modern-cms/admin dev
```

Required `.env` in `apps/api/`:
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-strong-secret
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL_DAYS=30
```

---

## Permission Test — curl Examples

### 1. Login as superadmin
```bash
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@example.com","password":"SuperAdmin123!"}' \
  | jq -r '.accessToken')
```

### 2. Debug: who am I?
```bash
curl http://localhost:4000/access/debug/me \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Debug: analytics (requires analytics:view)
```bash
# As superadmin — succeeds
curl http://localhost:4000/access/debug/analytics \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: <tenant-id>"

# As mallmanager — check permission
MANAGER_TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mallmanager@example.com","password":"MallManager123!"}' \
  | jq -r '.accessToken')

curl http://localhost:4000/access/debug/analytics \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "x-tenant-id: <mall-group-tenant-id>"
# MALL_MANAGER has analytics:view → 200 OK
```

### 4. Debug: content-publish (requires content:publish)
```bash
# As CONTENT_EDITOR (no content:publish) — 403
EDITOR_TOKEN=...
curl -X POST http://localhost:4000/access/debug/content-publish \
  -H "Authorization: Bearer $EDITOR_TOKEN" \
  -H "x-tenant-id: <tenant-id>"
# → {"success":false,"error":{"code":"FORBIDDEN","message":"Eksik yetki: content:publish"}}

# As MALL_MANAGER — 200 (has content:publish)
curl -X POST http://localhost:4000/access/debug/content-publish \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "x-tenant-id: <mall-group-tenant-id>"
```

### 5. Mall access enforcement
```bash
# mallmanager tries to access Mall of Bursa (not assigned)
curl http://localhost:4000/malls/my \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "x-tenant-id: <mall-group-tenant-id>" \
  -H "x-mall-id: <mall-of-bursa-id>"
# → 403 FORBIDDEN
```

### 6. My tenants
```bash
curl http://localhost:4000/tenants/my \
  -H "Authorization: Bearer $TOKEN"
```

### 7. My malls for a tenant
```bash
curl http://localhost:4000/malls/my \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: <tenant-id>"
```

---

## Audit Log Inspection

```bash
# Recent audit records (requires psql or your DB tool)
SELECT
  al.action,
  al.resource,
  al."resourceId",
  u.email AS actor,
  al.metadata,
  al."createdAt"
FROM "AuditLog" al
LEFT JOIN "User" u ON u.id = al."actorUserId"
ORDER BY al."createdAt" DESC
LIMIT 20;

# Login events only
SELECT action, metadata, "createdAt"
FROM "AuditLog"
WHERE action IN ('login_success', 'login_failed')
ORDER BY "createdAt" DESC
LIMIT 20;
```

---

## Expected Behavior by Role

### SUPER_ADMIN (`superadmin@example.com`)

- `/access/debug/me` → 200, `isSuperAdmin: true`
- `/access/debug/analytics` → 200 (bypass — no permission check for superadmin)
- `/access/debug/content-publish` → 200
- `/tenants/my` → all tenants
- `/malls/my` with any valid `x-tenant-id` → all malls of that tenant
- Audit: `login_success` event written on every successful login

### TENANT_ADMIN (`groupadmin@example.com`)

- `/access/debug/me` → 200, `isSuperAdmin: false`
- `/access/debug/analytics` with Mall Group `x-tenant-id` → 200 (has `analytics:view`)
- `/access/debug/content-publish` with Mall Group `x-tenant-id` → 200 (TENANT_ADMIN has all permissions)
- `/tenants/my` → Mall Group only
- `/malls/my` with Mall Group `x-tenant-id` → all malls (Mall of İstanbul + Mall of Bursa)
- Wrong `x-tenant-id` → 401/403

### MALL_MANAGER (`mallmanager@example.com`)

- `/access/debug/analytics` with Mall Group `x-tenant-id` → 200 (has `analytics:view`)
- `/access/debug/content-publish` → 200 (MALL_MANAGER has `content:publish`)
- `/malls/my` with Mall Group `x-tenant-id` → only Mall of İstanbul
- `/malls/my` with `x-mall-id` = Mall of Bursa ID → 403 (not assigned)
- Wrong tenant header → 401/403

---

## Using @AuditAction in Future CMS Modules

```typescript
// In any controller that performs writes:
import { AuditAction } from '../common/decorators/audit-action.decorator';

@Post()
@AuditAction('slider:create')
async create(@Body() dto: CreateSliderDto, @CurrentUser() user: User) {
  return this.sliders.create(dto, user);
}
// AuditInterceptor fires automatically on success,
// logs the action with full request context.
```

For operations where you need `before`/`after` state (e.g., update/delete):

```typescript
// Inject AuditLogService directly in the service:
await this.audit.logAction({
  userId: user.id,
  tenantId: req.tenantId,
  action: 'slider:update',
  entityType: 'slider',
  entityId: slider.id,
  before: { title: existing.title },
  after: { title: dto.title },
});
```

---

## Assumptions

1. No Prisma schema migration needed — `AuditLog.metadata` (JSON) stores `ip`, `userAgent`, `before`, `after`.
2. Debug endpoints are production-safe: they return 404 when `NODE_ENV=production` and `ENABLE_DEBUG_ENDPOINTS` is not set.
3. `@AuditAction` interceptor logs on success only. Error-path audit logging should be done manually where required.
4. Access tokens are stored in `localStorage` (standard SPA pattern). XSS risk is accepted at this stage; `httpOnly` cookie strategy can replace it later without API changes.
5. Superadmin bypass in `PermissionsGuard` is intentional and safe — superadmin is a platform-level flag, not a tenant role.
