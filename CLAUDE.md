# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Start Postgres + Redis (required before dev)
docker compose up -d postgres redis

# Run all apps in dev mode (api + admin + worker)
pnpm dev

# Run individual apps
pnpm dev:api
pnpm dev:admin
pnpm dev:worker

# Build all packages and apps
pnpm build

# Type-check all workspaces
pnpm typecheck

# Lint all workspaces
pnpm lint

# Format
pnpm format

# Database
pnpm db:migrate      # run migrations (prisma migrate dev)
pnpm db:seed         # seed initial data
pnpm db:generate     # regenerate Prisma client after schema changes
```

API runs on port 4000. Admin runs on port 5173. After `pnpm db:generate`, turbo will automatically run it before build/lint/typecheck.

## Architecture

### Monorepo Structure

- **apps/api** — NestJS HTTP API (port 4000). Single backend for both admin and public consumers.
- **apps/admin** — React + Vite admin UI (port 5173). Internal management interface.
- **apps/worker** — Minimal TypeScript background worker for queue jobs.
- **packages/shared** — Common TypeScript types and enums shared across apps.
- **packages/ui** — Shared React components.
- **packages/public-sdk** — Framework-agnostic TypeScript client (`CmsPublicClient`) for the public API. Built to `dist/`.
- **packages/config** — Shared TypeScript base configs.

Toolchain: **pnpm 9** workspaces + **Turborepo**. Build order is managed by turbo task graph (packages build before apps; `db:generate` is a dependency of build/lint/typecheck).

### Multi-Tenant Model

The platform is multi-tenant. Every request carries context via HTTP headers:
- `x-tenant-id` — identifies the tenant
- `x-mall-id` — identifies the specific location/mall within a tenant

`TenantContextMiddleware` attaches these to `req.tenantId` and `req.mallId`. The `Request` type is augmented in `apps/api/src/types/`.

### API Auth & Guard Stack

Every admin API route runs through four guards in order:

1. **`JwtAuthGuard`** — validates Bearer JWT, loads `req.user`
2. **`TenantAccessGuard`** — when `@RequireTenantContext()` is used, validates `x-tenant-id` and user membership
3. **`MallAccessGuard`** — when `@RequireMallContext()` is used, validates `x-mall-id` against user's allowed malls
4. **`PermissionsGuard`** — when `@RequirePermission('code')` or `@RequireAnyPermission([...])` is used, checks effective permissions

**`@Public()`** decorator bypasses all guards — used on public endpoints and auth routes.

**Super Admin bypass:** `user.isSuperAdmin = true` passes all guards automatically. Exception: `GlobalStoresController` has an explicit `isSuperAdmin` check for write operations regardless of permissions.

Effective permissions are resolved via: `TenantUser → Role → RolePermission → Permission.code`.

### RBAC & Capabilities

Two-layer access control:

- **Capability**: Feature module enabled per-tenant (e.g., `sliders`, `cinema`, `stores`). Managed by SUPER_ADMIN via Capabilities page. Lives in `TenantCapability` table.
- **Permission**: Action a user can perform (`slider:create`, `event:delete`, etc.). Assigned per `Role → RolePermission`.

A page/feature requires **both** the capability enabled for the tenant **and** the permission in the user's role.

System roles: `SUPER_ADMIN`, `TENANT_ADMIN`, `MALL_MANAGER`, `CONTENT_EDITOR`, `REPORT_VIEWER`. Custom roles can be created per-tenant. See `docs/ROLE_PERMISSION_MATRIX.md` for full permission matrix.

**Critical guard:** The SUPER_ADMIN system role's critical platform permissions cannot be removed (enforced in `RolesService.assertSuperAdminCriticalPermissions`).

### Admin Frontend

- **Router**: React Router v7, defined in `apps/admin/src/router/index.tsx`
- **Auth context**: `useAuth()` hook — provides `user`, `activeTenantId`, `activeMallId`, memberships
- **Permission check**: `usePermission()` hook — `can('permission:code')`, `canAny(...codes)`
- **Route guard**: `<PermissionGate permission="..." capability="..." superAdminOnly>` wraps each protected route
- **Navigation**: `NAV_ITEMS` in `apps/admin/src/navigation/config.ts` — each item has `permission`, optional `capability`, optional `superAdminOnly`, optional `requiresAudit`
- **Admin API client**: `apps/admin/src/lib/api/client.ts` — `request()` sends `Authorization: Bearer <token>`, `x-tenant-id`, `x-mall-id` on every call. Individual resource modules (e.g., `campaigns.ts`, `media.ts`) compose on top of `request()`.

### Public API & SDK

- Routes prefixed `/public/` use `@Public()` — no auth required
- `PublicModule` (`apps/api/src/public/`) uses Redis-backed cache (`PublicCacheService`) with TTLs (45–300s)
- `CmsPublicClient` in `packages/public-sdk/src/client.ts` sends `x-tenant-id` and `x-mall-id` on every request; does **not** send auth tokens
- All public responses use a typed envelope: `{ success: true, data: T, meta?: ... }`
- Swagger Developer Portal at `/developer` (Scalar), Swagger UI at `/api/docs`, raw OpenAPI at `/openapi.json` (Turkish), `/openapi.en.json` (English), `/openapi.ru.json` (Russian). OpenAPI spec is the single source of truth — auto-generated, never hand-edited.

### Database

Prisma ORM, PostgreSQL. Schema at `apps/api/prisma/schema.prisma`. After modifying the schema:
1. `pnpm db:migrate` — create and apply migration
2. `pnpm db:generate` — regenerate the Prisma client (turbo handles this automatically in build/typecheck)

### Media Storage

Local disk fallback (dev) or **Cloudflare R2** (production). Configured via `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` env vars. When R2 is configured, static file serving is disabled and all media URLs point to `R2_PUBLIC_URL`.

### Audit Logging

Controlled by `AUDIT_ENABLED=true` env var (disabled by default for MVP). When enabled, `AuditLogService.logAction()` writes to the `AuditLog` table. The `@AuditAction()` decorator on controller methods triggers logging. Admin UI shows audit logs gated behind `VITE_AUDIT_ENABLED`.

### DTO Pattern

Do **not** use `@nestjs/mapped-types` (`PartialType`, `OmitType`, etc.). Write `UpdateDto` classes manually with optional fields. This is a deliberate architectural decision.

### NestJS Module Pattern

Each feature is a self-contained NestJS module. Modules import only what they need: typically `PrismaModule`, `AccessModule`, and `AuditModule`. Export services that other modules consume. Check existing modules for the standard structure (controller + service + dto/ folder).

### Environment Variables

Root `.env` and `apps/api/.env` are both loaded by NestJS ConfigModule (searches `['.env', '.env.local', '../../.env', '../../.env.local']`). Key variables: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `API_PORT`, `CORS_ORIGINS`, `AUDIT_ENABLED`.
