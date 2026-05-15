# Sprint 26 — Context-Aware Image Upload & Crop Flow

## Overview

Sprint 26 adds a reusable `ContextualMediaPicker` component that replaces plain `<select>` dropdowns in all content forms. Editors can now select images from the existing library **or** upload new images directly from the form, with clear context about where the image will be used and recommended dimensions.

---

## Media Usage Context Presets

| Key | Label (TR) | Recommended |
|-----|-----------|-------------|
| `SLIDER_DESKTOP` | Slider Web Görseli | 1920×720 px |
| `SLIDER_MOBILE` | Slider Mobil Görseli | 768×1024 px |
| `SLIDER_KIOSK` | Slider Kiosk Görseli | 1080×1920 px |
| `EVENT_COVER` | Etkinlik Kapak Görseli | 1200×630 px |
| `CAMPAIGN_COVER` | Kampanya Kapak Görseli | 1200×630 px |
| `POPUP_IMAGE` | Popup Görseli | 800×800 px |
| `MOVIE_POSTER` | Film Afişi | 600×900 px |
| `STORE_LOGO` | Mağaza Logosu | 512×512 px |
| `LOCATION_LOGO` | Lokasyon Logosu | 512×512 px |
| `LOCATION_COVER` | Lokasyon Kapak Görseli | 1600×600 px |
| `SERVICE_ICON` | Hizmet İkonu | 256×256 px |
| `SERVICE_COVER` | Hizmet Kapak Görseli | 1200×630 px |

Presets are defined in `apps/admin/src/lib/media-contexts.ts`.

> **SLIDER_KIOSK** is defined but not yet wired to a form field — it is reserved for a future kiosk-specific image slot in the Slider model.

---

## New Database Fields (MediaAsset)

Three nullable fields were added to `MediaAsset` (migration `20260515125841_add_media_usage_context`):

| Field | Type | Purpose |
|-------|------|---------|
| `usageContext` | `String?` | The context key (e.g. `SLIDER_DESKTOP`) |
| `suggestedWidth` | `Int?` | Recommended width at upload time |
| `suggestedHeight` | `Int?` | Recommended height at upload time |

These are written on upload and surfaced in the API response. All fields are optional — existing assets are unaffected.

Run migration:
```bash
pnpm --filter api db:migrate
```

---

## ContextualMediaPicker Component

**Location:** `apps/admin/src/components/ContextualMediaPicker.tsx`

### Props

```typescript
interface Props {
  context: MediaUsageContextKey; // one of the 12 preset keys
  value: string;                 // current media asset ID ('' if none)
  onChange: (mediaId: string) => void;
  mallId?: string;               // scope library & uploads to a specific mall
  disabled?: boolean;
}
```

### UI Behaviour

1. **Context header** — shows the preset label and recommended dimensions.
2. **Preview** — fetches and displays the currently selected asset thumbnail.
3. **"Kütüphaneden Seç"** — opens a searchable image grid (full-screen overlay). Search is debounced at 350 ms. Click a thumbnail to highlight, press "Seç" to confirm.
4. **"Yeni Yükle"** — opens the upload panel. Steps:
   - Click/drop to select a file (`image/*`).
   - Dimensions are read client-side via `Image.naturalWidth/Height`.
   - **Dimension warning** shown (amber box) if image is smaller than recommended — upload is not blocked.
   - Optional alt-text input.
   - On confirm, image is uploaded to `POST /media/upload` with `usageContext`, `suggestedWidth`, `suggestedHeight`, and `tags: [contextKey]` encoded in the form data.
   - After a successful upload the picker selects the new asset and closes.
5. **"Kaldır"** — clears the selection (sets `value` to `''`).

The component is self-contained: it calls `useAuth()` internally for the access token and tenant ID, then loads assets on demand when modals open. No parent-level `apiMediaList` setup required.

---

## Upload / Tag Strategy

When an image is uploaded through `ContextualMediaPicker`:

- `usageContext` = preset key (e.g. `"EVENT_COVER"`)
- `suggestedWidth` / `suggestedHeight` = preset recommended dimensions
- `tags` = `["EVENT_COVER"]` (allows filtering by usage in the media library)
- `altText` = editor-entered value (optional)

---

## Forms Updated

| Page | Field(s) | Context(s) |
|------|----------|------------|
| `SlidersPage` | `desktopMediaId`, `mobileMediaId` | `SLIDER_DESKTOP`, `SLIDER_MOBILE` |
| `EventsPage` | `coverMediaId` | `EVENT_COVER` |
| `CampaignsPage` | `coverMediaId` | `CAMPAIGN_COVER` |
| `PopupsPage` | `imageMediaId` | `POPUP_IMAGE` |
| `MoviesPage` | `posterMediaId` | `MOVIE_POSTER` |
| `GlobalStoresPage` | `logoMediaId` | `STORE_LOGO` |
| `LocationDetailPage` | `logoMediaId`, `coverMediaId` | `LOCATION_LOGO`, `LOCATION_COVER` |
| `ServicesPage` | `iconMediaId`, `coverMediaId` | `SERVICE_ICON`, `SERVICE_COVER` |

**SlidersPage `videoMediaId`** was kept as a plain text input because it accepts video assets, not images.

**LocationDetailPage** now initialises `logoMediaId` and `coverMediaId` from the location object — previously these fields existed in `UpdateLocationPayload` but were not shown in the UI.

---

## Public API

No breaking changes. The `MediaAsset` response object gains three new nullable fields (`usageContext`, `suggestedWidth`, `suggestedHeight`) which are always present but may be `null` for assets uploaded before Sprint 26.

---

## Future Image Pipeline Notes

- **Crop UI**: a basic dimension warning is shown. A full crop/resize step (e.g. `react-image-crop`) can be inserted in `UploadPanel` before the `apiMediaUpload` call without changing the API contract.
- **Image variants**: The `MediaVariant` model already exists. Variants can be auto-generated server-side keyed by `usageContext` dimensions after upload.
- **Kiosk slider slot**: Add `kioskMediaId` to the `Slider` model and wire `SLIDER_KIOSK` to it in `SlidersPage`.
- **Folder auto-assignment**: The upload currently does not auto-assign a folder. A `contextToFolder` map could auto-place uploads into named folders (e.g. "Sliders / Web").
