# Sprint 7 — Admin UX Foundation & Routing Cleanup

## Overview

Sprint 7 refactors the admin frontend from an MVP shell into a scalable, production-oriented architecture. No visual redesign — focus is entirely on code structure, routing, layout, and UX infrastructure.

---

## 1. Routing Architecture

**Router:** `react-router-dom` v7 with `createBrowserRouter`.

**Route tree:**

```
/login            → AuthLayout  → LoginPage         (public; redirects to /dashboard if logged in)
/                 → ProtectedRoute → DashboardLayout
  /dashboard      → DashboardPage
  /media          → MediaPage
  /sliders        → SlidersPage
  /events         → EventsPage
  /campaigns      → CampaignsPage
  /store-categories → StoreCategoriesPage
  /global-stores  → GlobalStoresPage
  /mall-stores    → MallStoresPage
*                 → Navigate to /dashboard
```

**Files:**

- `src/router/index.tsx` — route definition
- `src/router/ProtectedRoute.tsx` — redirects unauthenticated users to `/login`

**Guard logic:**
- `ProtectedRoute` checks `accessToken`; if missing, `<Navigate to="/login" replace />`
- `AuthLayout` checks `accessToken`; if present, `<Navigate to="/dashboard" replace />`
- Both wait for `profileLoading` to resolve before redirecting

---

## 2. Layout Architecture

```
App
└── AuthProvider
    └── RouterProvider
        ├── AuthLayout          (/login)
        │   └── LoginPage
        └── ProtectedRoute
            └── DashboardLayout
                ├── Header        (sticky top bar)
                │   ├── TenantMallSelector
                │   └── UserMenu
                ├── Sidebar       (fixed left nav)
                └── <Outlet>      (page content)
                    └── PageContainer
                        ├── PageHeader
                        └── page body
```

**Files:**

| File | Responsibility |
|------|---------------|
| `src/layouts/AuthLayout.tsx` | Centered card wrapper for login page |
| `src/layouts/DashboardLayout.tsx` | Full-screen layout: header + sidebar + content |
| `src/components/layout/Sidebar.tsx` | Persistent left navigation |
| `src/components/layout/Header.tsx` | Top bar with tenant/mall selector and user menu |
| `src/components/layout/UserMenu.tsx` | Avatar, name, super-admin badge, logout |
| `src/components/layout/PageContainer.tsx` | Max-width content wrapper with padding |
| `src/components/layout/PageHeader.tsx` | Title, subtitle, action slot, meta slot |

---

## 3. Navigation System

**File:** `src/navigation/config.ts`

Each nav item has:
- `id` — unique identifier
- `label` — display name (Turkish)
- `icon` — unicode symbol (swap with icon library later)
- `href` — route path
- `permission` — required permission string (`null` = always visible)
- `group` — optional grouping label for sidebar sections

The sidebar (`Sidebar.tsx`) reads the nav config, filters by `can(permission)` from `usePermission`, and renders grouped sections. Active route is highlighted via react-router's `NavLink`.

---

## 4. Auth Flow

```
App boot
  → localStorage check (loadTokensFromStorage)
  → if token found: profileLoading = true
  → AuthProvider fetches /auth/me + /tenants/my
  → success: SET_PROFILE → profileLoading = false
  → failure: CLEAR_SESSION → redirect to /login

Login
  → POST /auth/login
  → SET_SESSION (token persisted to localStorage)
  → navigate('/dashboard')

Logout
  → clearSession() → tokens removed from localStorage
  → router redirects to /login (ProtectedRoute fails)

401 auto-logout
  → any API call returns 401
  → client fires window CustomEvent('cms:unauthorized')
  → AuthProvider listener calls CLEAR_SESSION
  → router redirects to /login
```

---

## 5. API Layer Structure

Old monolithic `lib/api.ts` (1095 lines) split into:

```
src/lib/api/
  client.ts     — base request(), onUnauthorized(), 401 handling
  auth.ts       — login, me, tenants, malls
  media.ts      — upload, list, delete, folders
  sliders.ts    — CRUD + publish/archive/reorder
  events.ts     — CRUD + publish/archive
  campaigns.ts  — CRUD + publish/archive
  stores.ts     — store categories, global stores, mall stores
  index.ts      — barrel re-export (all existing imports still work)
```

**Key features of `client.ts`:**
- 401 detection → fires `cms:unauthorized` event → AuthProvider clears session
- Normalized error extraction (`body.error.message` or `body.message`)
- FormData detection (no `Content-Type` header when uploading files)
- Injected headers: `Authorization`, `x-tenant-id`, `x-mall-id`

---

## 6. Reusable UI Components

**Location:** `src/components/ui/`

| Component | Purpose |
|-----------|---------|
| `Button` | Primary / secondary / danger / ghost variants, sm/md sizes, loading state |
| `Badge` | Status chips: gray / blue / green / yellow / red |
| `EmptyState` | Dashed box with title, description, optional action |
| `LoadingState` | Centered "Yükleniyor…" text |
| `ErrorBanner` | Red error bar with dismiss button |

All components use inline styles consistent with the existing codebase (no Tailwind, no CSS modules needed yet).

---

## 7. Page Shell Pattern

Every page now follows:

```tsx
<PageContainer>
  <PageHeader
    title="Sayfa Başlığı"
    meta={<span>{count} kayıt</span>}
    action={<Button variant="primary" onClick={openCreate}>+ Yeni</Button>}
  />
  {/* filter bar */}
  {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
  {loading ? <LoadingState /> : /* table/grid */}
</PageContainer>
```

Applied to all 7 content pages: Media, Sliders, Events, Campaigns, Store Categories, Global Stores, Mall Stores.

---

## 8. Toast / Notification System

**Library:** `sonner` v2 (zero-config, beautiful defaults)

**Integration:**
- `<Toaster position="top-right" richColors closeButton />` in `App.tsx`
- `toast.success(...)` on create / update / delete / publish / archive
- `toast.error(...)` on action failures (replaces setError for transient errors)
- Persistent load errors still use `ErrorBanner` (dismissible inline banner)

---

## 9. Permission-Aware Navigation

**Hook:** `src/hooks/usePermission.ts`

```ts
const { can } = usePermission();
can('sliders:list') // → boolean
```

**Logic:**
1. No user → `false`
2. Super admin → `true` (bypass all checks)
3. Active tenant membership with admin/manager role → `true`
4. Read permissions → allowed for any tenant member
5. Backend remains the authoritative enforcement layer

Sidebar automatically filters nav items using `can(item.permission)`.

---

## 10. Dashboard

**Route:** `/dashboard`

Shows:
- 4 stat cards (sliders, events, campaigns, global stores) — live counts from API
- Session info card (email, status, role)
- Active context card (active tenant + mall)
- Graceful empty state when no tenant selected

Stats use `Promise.allSettled` so individual failures don't break the dashboard.

---

## 11. Future Extensibility Notes

### Adding a new module
1. Create `src/pages/NewPage.tsx`
2. Add route to `src/router/index.tsx`
3. Add nav item to `src/navigation/config.ts`
4. Add API functions to `src/lib/api/new-module.ts` and export from `index.ts`

### Adding icons
Replace the unicode symbols in `navigation/config.ts` with any icon library (e.g., lucide-react). The `icon` field is a `string` — change it to `ReactNode` when ready.

### Granular permissions
Extend `usePermission.ts` with a permission map keyed by role code. The hook interface (`can(permission)`) is stable — callers don't change.

### Code splitting
The router uses eager imports. Switch to `React.lazy()` + `<Suspense>` per route for code-split chunks when bundle size becomes a concern.

### Mobile sidebar
`DashboardLayout` has the structure in place. Add a toggle state + `transform: translateX` on the sidebar, controlled by a hamburger button in `Header`, to enable mobile nav.
