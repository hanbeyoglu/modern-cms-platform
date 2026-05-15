---
name: project-sprint24
description: Sprint 24 — Public API Contract & Frontend Integration Readiness completed 2026-05-15
metadata:
  type: project
---

Sprint 24 completed 2026-05-15. Public API contract standardized for headless frontend separation.

**Key deliverables:**
- `PublicEnvelope<T>` wrapper on all 13 public endpoints (`success`, `locale`, `tenant`, `data`)
- `PublicMediaAsset` replaces `PublicMediaRef` — now includes `id`, `width`, `height`, `alt`, `caption`, `dominantColor`
- `PublicSeoMeta` object added to page, event, campaign, store responses
- `PublicSearchHitDto` enhanced: `type` (lowercase), `description`, `image`, `url`, `locale` fields
- New `packages/public-sdk` package: `CmsPublicClient`, typed interfaces, locale/pagination helpers, analytics event contract
- `docs/FRONTEND_INTEGRATION.md` — full frontend developer guide
- `docs/SPRINT24.md` — sprint summary

**Why:** CMS is headless; frontend projects are separate repos. The contract needed to be predictable, typed, and frontend-friendly before any real frontend integration.

**How to apply:** New public API responses all have `{ success, locale, tenant, data }` envelope. SDK is at `@modern-cms/public-sdk`. See [[project-sprint23]] for media model fields (altText, caption, dominantColor exist in DB since Sprint 23).
