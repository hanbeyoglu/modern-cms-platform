# Sprint 22 — Audit Log Viewer & Admin Activity Center

## Overview

Sprint 22 transforms the platform's raw audit infrastructure into a full enterprise-grade governance and activity system. Every write operation in the system is now traced, severity-classified, and browsable through a dedicated admin UI with filtering, detail views, entity timelines, and export capabilities.

---

## 1. Audit Architecture

### Data Model

The `AuditLog` table was extended in migration `20260515220000_sprint22_audit_severity`:

| New column | Type | Purpose |
|---|---|---|
| `resourceName` | `String?` | Human-readable entity name (e.g. "Marketing Campaign") |
| `severity` | `AuditSeverity` | Classification of the event (default `INFO`) |
| `source` | `String?` | Originating system ("api", "worker", "scheduler") |
| `success` | `Boolean` | Whether the action succeeded (default `true`) |
| `correlationId` | `String?` | Cross-request tracing ID (from `x-correlation-id` header) |
| `requestId` | `String?` | Per-request UUID for granular traceability |

New indexes: `(severity, createdAt)`, `(resource, createdAt)`, `(correlationId)`, `(success, createdAt)`.

### AuditLogService

Enhanced methods:

- `logAction(payload)` — core write method; accepts all new fields
- `list(actor, query, scopedTenantId)` — paginated, filtered listing with RBAC scoping
- `findOne(id, actor, scopedTenantId)` — single record with RBAC check
- `timeline(entityType, entityId, actor, scopedTenantId)` — entity-scoped history
- `exportCsv(...)` / `exportJson(...)` — bulk export up to 5,000 records
- `recentActivity(tenantId?, limit?)` — dashboard widget feed
- `securityEvents(tenantId?, limit?)` — SECURITY/CRITICAL events feed

### Correlation ID Middleware

`CorrelationIdMiddleware` runs before all requests and:
- Reads `x-correlation-id` from the incoming request header (if provided by the caller)
- Generates a fresh UUID as `x-request-id`
- Sets both on the Express `Request` object (`req.correlationId`, `req.requestId`)
- Echoes both back in the response headers

The `AuditInterceptor` now includes both IDs in every interceptor-fired audit entry.

---

## 2. Severity Strategy

```
INFO     — routine content CRUD (create, update, publish, archive)
WARNING  — unusual but non-critical events (publish with gaps, repeated failures)
ERROR    — operation failures, worker errors
SECURITY — privilege/permission changes, password resets, capability updates
CRITICAL — tenant deactivation/suspension, super admin changes
```

### Applied mappings

| Action | Module | Severity |
|---|---|---|
| `password_reset_requested` | users | SECURITY |
| `role_permissions_updated` | roles | SECURITY |
| `capability_updated` | capabilities | SECURITY |
| `tenant:deactivate` | tenants | CRITICAL |
| `tenant:reactivate` | tenants | SECURITY |
| All content CRUD | sliders, events, campaigns, pages | INFO (default) |

---

## 3. RBAC Visibility

| Role | Scope |
|---|---|
| `SUPER_ADMIN` | All tenants, all severities |
| `TENANT_ADMIN` | Own tenant only; `audit:read` only (no security/export) |
| `MALL_MANAGER` | Own tenant; `audit:read` only |
| `CONTENT_EDITOR` | No audit access by default |
| `REPORT_VIEWER` | No audit access by default |

### New permissions

| Permission | Purpose |
|---|---|
| `audit:read` | View audit log list and individual records |
| `audit:security` | Access SECURITY/CRITICAL events endpoint |
| `audit:export` | Download CSV/JSON exports |

---

## 4. API Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/audit-logs` | `audit:read` | Paginated list with filters |
| GET | `/audit-logs/:id` | `audit:read` | Single record detail |
| GET | `/audit-logs/timeline/:entityType/:entityId` | `audit:read` | Entity-scoped history |
| GET | `/audit-logs/recent-activity` | `audit:read` | Dashboard feed (newest first) |
| GET | `/audit-logs/security-events` | `audit:security` | SECURITY+CRITICAL events |
| GET | `/audit-logs/export` | `audit:export` | CSV or JSON bulk download |

### Query params (list endpoint)

`page`, `limit`, `tenantId`, `mallId`, `actorId`, `resource`, `action`, `severity`, `success`, `dateFrom`, `dateTo`, `search`, `correlationId`

### Export params

`format=csv|json` plus all list filters; max 5,000 records per export.

---

## 5. Timeline Strategy

The `AuditTimeline` component (`apps/admin/src/components/AuditTimeline.tsx`) is embedded in:

- `UserDetailPage` — entity type `user`
- `RoleDetailPage` — entity type `role`
- `TenantDetailPage` — entity type `tenant`
- `LocationDetailPage` — entity type `location`
- `PageDetailPage` — entity type `page`

Each timeline:
- Loads via `GET /audit-logs/timeline/:entityType/:entityId`
- Shows newest first, max 50 records
- Color-codes the dot by severity
- Supports expandable detail rows with correlation ID and detail link
- Renders only if the current user has `audit:read`

---

## 6. Audit Coverage Summary

| Module | Coverage |
|---|---|
| Users | ✅ create, update, status, membership CRUD, password reset (SECURITY) |
| Roles | ✅ create, update, permissions (SECURITY), clone, delete |
| Tenants | ✅ create, update, status change (CRITICAL for deactivation) |
| Malls/Locations | ✅ create, update, status, delete |
| Sliders | ✅ create, update, delete, publish, archive |
| Events | ✅ create, update, delete, publish, archive |
| Campaigns | ✅ create, update, delete, publish, archive |
| Pages | ✅ create, update, delete, publish, archive |
| Capabilities | ✅ updateTenantCapabilities (SECURITY) |
| Settings | ✅ (pre-existing) |
| Notifications | ⬜ read-only; audit not applicable |
| Translations | ⬜ high-frequency; content-only; not prioritized |

---

## 7. Dashboard Changes

The `DashboardPage` now includes two new widgets (permission-gated):

- **Recent Activity** (requires `audit:read`) — last 8 events across the active tenant
- **Security Events** (requires `audit:security`) — last 5 SECURITY/CRITICAL events with red accent

Both link through to `/audit-logs` for the full view.

---

## 8. Correlation IDs

Every HTTP request receives:

- `x-correlation-id` — echoed from the caller or auto-generated UUID; stable across retries
- `x-request-id` — fresh UUID per request; for granular log matching

These are available in:
- Response headers (all requests)
- `AuditLog.correlationId` / `.requestId` columns
- Audit detail page (traceability section)

Future use: pass `x-correlation-id` to Sentry scope, forward to worker jobs for cross-service tracing.

---

## 9. Export Rules

- Requires `audit:export` permission
- Always scoped to the actor's tenant (non-super-admins cannot export cross-tenant)
- Maximum 5,000 records per request (enforced server-side)
- CSV includes: id, timestamp, actor email, tenant name, mall name, action, resource, resourceId, resourceName, severity, source, success, correlationId, requestId
- JSON returns the same paginated list structure

---

## 10. Future SIEM / Sentry Integration Ideas

### Sentry

- Add `correlationId` to Sentry scope via middleware: `Sentry.setTag('correlationId', req.correlationId)`
- Include `requestId` in breadcrumbs

### SIEM / log shipping

- Stream `AuditLog` rows to SIEM (Splunk, Elastic SIEM, Datadog) via:
  - Prisma middleware that publishes to a message queue on `auditLog.create`
  - Or a cron that polls recent rows and ships batches
- Filter by `severity IN (SECURITY, CRITICAL)` for real-time alerting rules

### Notification integration

- Add a notification trigger in `AuditLogService.logAction()` for `severity === CRITICAL`
- Could leverage the existing `NotificationsService` to push in-app alerts to SUPER_ADMINs

---

## 11. Migration Command

```bash
# Apply migration (already run)
cd apps/api && npx prisma migrate deploy

# Re-run seed to add new permissions and role assignments
cd apps/api && npx prisma db seed
```

---

## 12. Quality

- `pnpm typecheck` ✅ (both `api` and `admin`)
- `pnpm build` ✅ (verified in sprint completion)
- `smoke:di:dist` ✅ (DI checks pass with new AuditModule exports)
- No breaking changes to existing API contracts
