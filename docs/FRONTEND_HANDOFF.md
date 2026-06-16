# Frontend Handoff Checklist

CMS public API ile **ayrı bir frontend** (web / mobil / kiosk) geliştirecek ekip için kısa teslim listesi. Ayrıntılı sözleşme: [PUBLIC_API_GUIDE.md](./PUBLIC_API_GUIDE.md).

---

## Ön koşullar

- [ ] Backend’den **tenant ID** (`x-tenant-id`) alındı
- [ ] Hedef AVM için **mall ID** (`x-mall-id`) alındı (mağaza / hizmet / sinema için zorunlu)
- [ ] API **base URL** (dev/stage/prod) netleştirildi
- [ ] Desteklenen **locale** kodları (`site-config.supportedLocales`) doğrulandı

---

## Zorunlu istek bağlamı

Her public istekte:

| Öğe | Nerede | Not |
|-----|--------|-----|
| `x-tenant-id` | Header | Zorunlu |
| `x-mall-id` | Header | Mağaza, hizmet, sinema, seans için zorunlu |
| `locale` | Query `?locale=tr` | Yoksa varsayılan dil |
| `channel` | Query | Slider & popup: `WEB` \| `MOBILE` \| `KIOSK` \| `SIGNAGE` |

JWT / API key **gerekmez**.

---

## Uygulanması önerilen rotalar

| Sayfa / özellik | API |
|-----------------|-----|
| Bootstrap / layout | `GET /public/site-config` |
| Ana sayfa | `GET /public/home` veya ayrı: sliders + listeler |
| Hero / carousel | `GET /public/sliders?placement=HOME&channel=...` |
| Kampanyalar listesi | `GET /public/campaigns` |
| Kampanya detay | `GET /public/campaigns/:slug` + `sliders?placement=CAMPAIGN&entityId=` |
| Etkinlikler | `GET /public/events`, `GET /public/events/:slug` |
| Mağazalar | `GET /public/stores`, `GET /public/stores/:slug` |
| Hizmetler | `GET /public/services` |
| Yasal / CMS sayfaları | `GET /public/pages/:slug` (ör. `kvkk`) |
| Site içi arama | `GET /public/search?q=` |
| Popup | `GET /public/popups?channel=` |
| Sinema (varsa) | `GET /public/cinema`, `GET /public/movie-sessions` |

---

## Veri sözleşmesi (tasarımdan bağımsız)

- [ ] Yanıtlar `{ success, locale, tenant, data }` veya sayfalı `{ pagination, data: [] }`
- [ ] Medya: `url`, `alt`, `width`/`height`, isteğe bağlı `widthOverride`/`heightOverride`
- [ ] Kampanya / etkinlik: `publishStartAt`–`publishEndAt` (görünürlük) ayrı; `campaignStartAt` / `eventStartAt` (iş tarihi) ayrı
- [ ] Kampanya / etkinlik kapak: `image` (locale çözümlü); `coverMedia` deprecated
- [ ] Slider içeriği: **`items[]`** (kök `desktopMedia` deprecated)
- [ ] Sayfa: `renderMode` → `HTML` | `SINGLE_PDF` | `DOCUMENT_LIST`
- [ ] SEO: `entity.seo` + frontend’de canonical URL üretimi
- [ ] RTL: `site-config.rtl` veya `isRtlLocale()` (SDK)

---

## Ortam değişkenleri (örnek)

```bash
# .env.local (Next.js / Vite vb.)
CMS_API_URL=http://localhost:4000
CMS_TENANT_ID=clxxxxxxxxxxxxxxxx
CMS_MALL_ID=clxxxxxxxxxxxxxxxx
CMS_DEFAULT_LOCALE=tr
CMS_CHANNEL=WEB
```

Üretim örneği:

```bash
CMS_API_URL=https://api.yourdomain.com
CMS_TENANT_ID=...
CMS_MALL_ID=...
```

---

## SDK (önerilir)

```bash
# Monorepo içi
pnpm --filter @modern-cms/public-sdk build
```

```typescript
import { CmsPublicClient } from '@modern-cms/public-sdk';
```

Paket: [`packages/public-sdk`](../packages/public-sdk/).

---

## Önbellek & hatalar

- [ ] Cache key: `tenantId + mallId + locale + channel + endpoint`
- [ ] 400 → header/env kontrolü; 404 → boş/404 UI
- [ ] `HTML` sayfa içeriğinde XSS için sanitize (DOMPurify vb.)

---

## Smoke test (curl)

```bash
export API=http://localhost:4000
export TENANT=your-tenant-id
export MALL=your-mall-id

curl -sS -H "x-tenant-id: $TENANT" -H "x-mall-id: $MALL" \
  "$API/public/site-config?locale=tr" | jq .success

curl -sS -H "x-tenant-id: $TENANT" \
  "$API/public/sliders?placement=HOME&channel=WEB&locale=tr" | jq '.data | length'
```

---

## Dokümantasyon

- **Tam rehber:** [PUBLIC_API_GUIDE.md](./PUBLIC_API_GUIDE.md)
- **Tip tanımları:** `packages/public-sdk/src/types.ts`
- **Sorular:** önce rehber + SDK; eksik uç için backend issue
