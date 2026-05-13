---
name: project-sprint4
description: Sprint 4 Slider Management module completed 2026-05-13 — Prisma model, permissions, full API, admin UI
metadata:
  type: project
---

Sprint 4: Slider Management Module — completed 2026-05-13.

**Why:** First real CMS content module. Establishes the pattern for future modules (events, campaigns, stores, pages).

**What was built:**
- Prisma `Slider` model with enums `SliderStatus`, `SliderTargetDevice`, `SliderLinkType`
- 6 new permissions: `slider:read/create/update/delete/publish/reorder`
- Full NestJS `SlidersModule` (service + controller + DTOs) under `apps/api/src/sliders/`
- Admin UI: `SlidersPage.tsx` with list table, create/edit form, publish/archive/delete actions
- `getPublishedSlidersForPublic()` service method ready for future public website use
- `docs/SPRINT4.md` with full API docs and curl examples

**How to apply:** Future CMS modules (events, campaigns, stores) should follow the same module structure:
- DTOs with `!:` for required fields (no `@nestjs/mapped-types` installed)
- Write UpdateDto manually (not PartialType) — `@nestjs/mapped-types` is not in the project
- Service uses `SLIDER_INCLUDE` const + `Prisma.XGetPayload` for response typing
- Controller declares static routes (e.g. `reorder`) before parameterized (`:id`) routes

[[project_sprint2]]
