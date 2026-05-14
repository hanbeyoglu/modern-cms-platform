# Sprint 16 — Capability & Package System

## Overview

Sprint 16 introduces a **tenant-level capability system** that allows the platform to support different product tiers. Each tenant can have an individually configured set of enabled features, and both the API and admin UI respect that configuration.

No billing, no CDP features, and no payment integration were built — this sprint establishes the **foundation** that future billing/package logic will build on.

---

## Architecture

### Core Concept

Every tenant has a set of **enabled capabilities**. A capability is a stable string code that maps to a platform feature. Capabilities control:

- **API access** — guarded routes return `403 FEATURE_NOT_ENABLED` when the tenant lacks the capability.
- **Admin navigation visibility** — sidebar items are hidden when the tenant lacks the capability.
- **Future package/billing readiness** — `TenantCapability` rows carry `metadataJson` for tier metadata.

### Prisma Models

```prisma
model Capability {
  id          String             @id @default(cuid())
  code        String             @unique
  name        String
  description String?
  category    CapabilityCategory
  isSystem    Boolean            @default(true)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  tenantCapabilities TenantCapability[]
}

model TenantCapability {
  id           String   @id @default(cuid())
  tenantId     String
  capabilityId String
  enabled      Boolean  @default(true)
  enabledAt    DateTime?
  disabledAt   DateTime?
  metadataJson Json?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([tenantId, capabilityId])
}
```

### CapabilityCategory Enum

| Value | Description |
|---|---|
| `CORE` | Platform essentials |
| `CONTENT` | CMS content modules |
| `OPERATIONS` | Scheduling, notifications |
| `ANALYTICS` | Reporting and analytics |
| `LOCALIZATION` | Multi-language support |
| `PUBLIC_DELIVERY` | Public-facing delivery APIs |
| `SEARCH` | Full-text search |
| `CDP` | Customer Data Platform (future) |
| `AI` | AI features (future) |
| `INTEGRATION` | External integrations (future) |

---

## Capability Codes

### Currently Available

| Code | Category | Description |
|---|---|---|
| `cms_core` | CORE | Base CMS functionality |
| `media` | CORE | Media library |
| `public_api` | PUBLIC_DELIVERY | Public content delivery API |
| `sliders` | CONTENT | Slider/banner management |
| `pages` | CONTENT | Dynamic page builder |
| `stores` | CONTENT | Store management |
| `events` | CONTENT | Event management |
| `campaigns` | CONTENT | Campaign management |
| `cinema` | CONTENT | Cinema & movie sessions |
| `scheduling` | OPERATIONS | Content scheduling |
| `notifications` | OPERATIONS | In-app notifications |
| `analytics` | ANALYTICS | Analytics & reporting |
| `localization` | LOCALIZATION | Multi-language & translations |
| `search` | SEARCH | Global full-text search |

### Future / Not Enabled by Default

| Code | Category | Notes |
|---|---|---|
| `cdp_basic` | CDP | Basic CDP — not built yet |
| `cdp_advanced` | CDP | Advanced CDP — not built yet |
| `segments` | CDP | Customer segments — not built yet |
| `journeys` | CDP | Customer journeys — not built yet |
| `personalization` | CDP | Personalization engine — not built yet |
| `ai_assistant` | AI | AI content assistant — not built yet |
| `external_cinema_provider` | INTEGRATION | Cinema API/XML feed |
| `signage` | INTEGRATION | Digital signage |
| `mobile_app_api` | INTEGRATION | Mobile app API access |

---

## Suggested Product Tiers

These tiers are _illustrative_ — not enforced by the current system. A billing layer would map tiers to capability sets.

| Tier | Capabilities |
|---|---|
| CMS Only | `cms_core`, `media`, `public_api`, `sliders`, `pages` |
| CMS + Stores | above + `stores`, `events`, `campaigns` |
| CMS + Analytics | above + `analytics`, `search` |
| CMS + Advanced | above + `cinema`, `scheduling`, `notifications`, `localization` |
| Full Platform | all current capabilities |
| Full + CDP | all + `cdp_basic`, `cdp_advanced`, `segments`, `journeys`, `personalization` |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/capabilities` | `capability:read` | List all capability definitions |
| `GET` | `/tenants/:id/capabilities` | `capability:read` | Get tenant's capability state |
| `PATCH` | `/tenants/:id/capabilities` | `capability:update` | Update tenant capabilities |

### PATCH body

```json
{
  "capabilities": [
    { "code": "analytics", "enabled": true },
    { "code": "cdp_basic", "enabled": false }
  ]
}
```

Updates are **idempotent** — upserts by `(tenantId, capabilityId)`.

---

## Permissions

| Permission | SUPER_ADMIN | TENANT_ADMIN | MALL_MANAGER | CONTENT_EDITOR | REPORT_VIEWER |
|---|---|---|---|---|---|
| `capability:read` | ✓ | ✓ | — | — | — |
| `capability:update` | ✓ | — | — | — | — |

---

## Capability Guard

### Decorator

```typescript
@RequireCapability('analytics')
```

### Guard

`CapabilityGuard` reads the `x-tenant-id` header, loads enabled capability codes from `TenantCapability`, and throws `403` if the required capability is not enabled.

**Super admin bypass**: Super admins always pass the guard (they manage the platform, not a tenant).

### Error response

```json
{
  "statusCode": 403,
  "error": "FEATURE_NOT_ENABLED",
  "message": "Bu özellik tenant için etkin değil: analytics"
}
```

### Guarded routes (representative)

| Route | Required Capability |
|---|---|
| `GET /analytics/summary` | `analytics` |
| `GET /analytics/top-content` | `analytics` |
| `GET /analytics/timeseries` | `analytics` |
| `GET /locales` | `localization` |
| `POST /locales` | `localization` |
| `GET /translations` | `localization` |
| `GET /notifications` | `notifications` |
| `GET /search/global` | `search` |

---

## Auth / Me Response

`GET /auth/me` memberships now include a `capabilities` array:

```json
{
  "memberships": [
    {
      "tenantId": "...",
      "role": { "code": "TENANT_ADMIN", "name": "Tenant Admin" },
      "permissions": ["..."],
      "capabilities": ["cms_core", "analytics", "localization"],
      "malls": [...]
    }
  ]
}
```

---

## Admin UI

### Capability-aware Navigation

The sidebar filters navigation items by both RBAC permission **and** tenant capability. Items are hidden when the capability is disabled — no CDP placeholders are ever shown.

| Nav Item | Required Capability |
|---|---|
| Bildirimler | `notifications` |
| Genel Arama | `search` |
| Medya Kütüphanesi | `media` |
| Slider Yönetimi | `sliders` |
| Raporlar | `analytics` |
| Etkinlikler | `events` |
| Kampanyalar | `campaigns` |
| Sayfalar | `pages` |
| Diller | `localization` |
| Sinemalar / Filmler / Seanslar | `cinema` |
| Mağaza pages | `stores` |

### Yetenekler Page (`/capabilities`)

- **Super Admin only** — visible only when `isSuperAdmin === true`.
- Tenant selector at the top.
- Capabilities grouped by category with toggle switches.
- Save button with dirty-state detection.
- Route: `/capabilities`

### `useCapability` Hook

```typescript
const { has } = useCapability();
has('analytics'); // true if active tenant has analytics enabled
```

Super admins always return `true`. Legacy sessions (no `capabilities` array) return `true` until refreshed.

---

## CMS-only Tenants

A tenant with only `cms_core`, `media`, `public_api`, `sliders`, `pages` enabled will see:

- A clean sidebar with only CMS items.
- No analytics section.
- No language/translation pages.
- No notification bell.
- No global search.
- No cinema pages.
- No CDP or AI items (never shown).

---

## Demo Tenants

Both `emaar-avm` and `mall-group` demo tenants are seeded with all currently-built capabilities enabled:

```
cms_core, media, public_api, sliders, pages, stores, events, campaigns,
cinema, scheduling, notifications, analytics, localization, search
```

CDP capabilities are **not** enabled for demo tenants.

---

## Future: Billing / Package Integration

When billing is added:

1. Create a `Package` model with a set of capability codes.
2. On subscription creation, call `CapabilitiesService.updateTenantCapabilities()` with the package's code set.
3. On subscription cancellation/downgrade, disable capabilities that are no longer in the package.
4. The `TenantCapability.metadataJson` field can store package/subscription references.

The guard, decorator, and service layer require **no changes** — billing simply becomes the manager of which capabilities are enabled.

---

## Migration

```bash
cd apps/api
npx prisma migrate deploy
```

Migration file: `20260514172447_add_capability_package_system`

## Seed

```bash
cd apps/api
npx ts-node -r tsconfig-paths/register prisma/seed.ts
# or
npx prisma db seed
```

Idempotent — safe to re-run.
