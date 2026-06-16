# Public API — Frontend Developer Guide

Bu rehber, CMS **public API** ile bağımsız bir web, mobil veya kiosk arayüzü geliştirmek için gereken tüm bilgileri içerir. Backend ekibine sormadan uygulama geliştirebilmeniz hedeflenmiştir.

**İlgili kaynaklar**

| Kaynak | Açıklama |
|--------|----------|
| [`@modern-cms/public-sdk`](../packages/public-sdk/) | TypeScript istemci ve tipler |
| [`docs/FRONTEND_HANDOFF.md`](./FRONTEND_HANDOFF.md) | Kısa teslim checklist’i |
| API kaynak kodu | `apps/api/src/public/` |

---

## 1. Mimari

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  CMS Admin UI   │     │   CMS API       │     │  Sizin frontend  │
│  (apps/admin)   │────▶│  (apps/api)     │◀────│  (ayrı repo)     │
│  içerik yönetimi│     │  NestJS + DB    │     │  Next.js / RN /  │
└─────────────────┘     └────────┬────────┘     │  kiosk vb.       │
                                 │               └──────────────────┘
                                 │
                    GET /public/*  (okuma, API key yok)
                    x-tenant-id + x-mall-id + locale + channel
```

- **Admin ve API ayrıdır.** Yönetim paneli (`apps/admin`) yalnızca editörler içindir; ziyaretçi siteniz admin’e bağlanmaz.
- **Frontend repoları bağımsızdır.** Kendi Next.js, React Native, Flutter veya kiosk projenizi ayrı deploy edersiniz.
- **CMS yalnızca içerik/veri sağlar.** Tasarım, routing, state ve önbellek tamamen sizin uygulamanızda kalır. API tutarlı JSON envelope’ları döner; HTML üretmez (sayfa içeriği hariç `contentHtml` alanı).

**Önerilen akış**

1. Uygulama açılışında `GET /public/site-config` ile tenant, AVM, diller ve RTL bilgisini alın.
2. Kanalınıza göre (`WEB`, `MOBILE`, …) slider, popup ve listeleri çekin.
3. Detay sayfalarında slug tabanlı uçları (`/public/campaigns/:slug` vb.) kullanın.

---

## 2. Kimlik doğrulama ve istek başlıkları

Public uçlar **JWT veya API key gerektirmez**. Tenant ve (isteğe bağlı) AVM bağlamı HTTP başlıkları ve sorgu parametreleri ile taşınır.

### Zorunlu / önerilen başlıklar

| Başlık | Zorunlu | Açıklama |
|--------|---------|----------|
| `x-tenant-id` | **Evet** | Kiracı (marka/organizasyon) kimliği. Tüm public isteklerde gönderilmelidir. |
| `x-mall-id` | Koşullu | AVM / lokasyon kimliği. Mağaza, hizmet, sinema ve `movie-sessions` için **zorunludur**. Diğer uçlarda isteğe bağlı; gönderilirse içerik o AVM’ye göre filtrelenir. |
| `Accept` | Önerilir | `application/json` |

### Sorgu parametreleri (başlık değil)

| Parametre | Kullanım | Açıklama |
|-----------|----------|----------|
| `locale` | Çoğu uç | Dil kodu (`tr`, `en`, …). Yoksa veya geçersizse tenant varsayılan diline düşer (bkz. [Yerelleştirme](#7-yerelleştirme)). |
| `channel` | Slider, popup | Görünürlük kanalı: `WEB`, `MOBILE`, `KIOSK`, `SIGNAGE`. İlgili kayıtta `channels` dizisinde bu değer olmalıdır. |

### Örnek istek

```http
GET /public/campaigns?locale=tr&page=1&limit=20 HTTP/1.1
Host: api.example.com
x-tenant-id: clxxxxxxxxxxxxxxxx
x-mall-id: clxxxxxxxxxxxxxxxx
Accept: application/json
```

**Yerel geliştirme taban URL:** `http://localhost:4000` (bkz. `.env.example` → `API_PORT`).

---

## 3. Temel yanıt formatı

Tüm başarılı yanıtlar aynı envelope yapısını kullanır.

### Tek kayıt / dizi (sayfalanmamış)

```json
{
  "success": true,
  "locale": "tr",
  "tenant": {
    "id": "cltenant...",
    "mallId": "clmall..."
  },
  "data": { }
}
```

- `locale`: İstekte çözümlenen aktif dil kodu (fallback sonrası).
- `tenant.id`: Her zaman dolu.
- `tenant.mallId`: `x-mall-id` gönderildiyse ve geçerliyse dolu; aksi halde `null`.

### Sayfalanmış liste

```json
{
  "success": true,
  "locale": "tr",
  "tenant": { "id": "...", "mallId": "..." },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 84,
    "totalPages": 5
  },
  "data": [ ]
}
```

`data` her zaman **düz bir dizi**dir (iç içe `items` yok).

### Arama (`GET /public/search`)

Sayfalama aynıdır; sonuçlar `data.results` içindedir:

```json
{
  "success": true,
  "locale": "tr",
  "tenant": { "id": "...", "mallId": "..." },
  "pagination": { "page": 1, "limit": 12, "total": 3, "totalPages": 1 },
  "data": {
    "results": [
      {
        "type": "campaign",
        "id": "...",
        "slug": "yaz-indirimi",
        "title": "Yaz İndirimi",
        "description": "...",
        "image": "https://cdn.../cover.jpg",
        "url": "/public/campaigns/yaz-indirimi",
        "locale": "tr"
      }
    ]
  }
}
```

### Hata formatı

HTTP durum kodu + JSON gövde:

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "x-tenant-id header is required"
  }
}
```

| `error.code` | HTTP | Tipik neden |
|--------------|------|-------------|
| `BAD_REQUEST` | 400 | Eksik başlık, pasif tenant/AVM, zorunlu `x-mall-id` yok |
| `NOT_FOUND` | 404 | Tenant/AVM/slug bulunamadı |
| `UNAUTHORIZED` | 401 | Public uçlarda nadiren |
| `INTERNAL_SERVER_ERROR` | 500 | Sunucu hatası |

---

## 4. Public uçlar

Aşağıdaki tabloda `Mall` sütunu `x-mall-id` gereksinimini gösterir.

| Metot | Yol | Mall | Özet |
|-------|-----|------|------|
| GET | `/public/site-config` | Hayır | Tenant, AVM, diller, RTL |
| GET | `/public/media-guidelines` | Hayır | Görsel boyut önerileri |
| GET | `/public/home` | Hayır* | Ana sayfa paketi (slider + öne çıkanlar) |
| GET | `/public/sliders` | Hayır* | Slider grupları |
| GET | `/public/campaigns` | Hayır* | Kampanya listesi |
| GET | `/public/campaigns/:slug` | Hayır* | Kampanya detayı |
| GET | `/public/events` | Hayır* | Etkinlik listesi |
| GET | `/public/events/:slug` | Hayır* | Etkinlik detayı |
| GET | `/public/stores` | **Evet** | Mağaza listesi |
| GET | `/public/stores/:slug` | **Evet** | Mağaza detayı |
| GET | `/public/services` | **Evet** | AVM hizmetleri |
| GET | `/public/services/:id` | Hayır* | Hizmet detayı |
| GET | `/public/popups` | Hayır* | Popup listesi |
| GET | `/public/pages/:slug` | Hayır* | Statik/CMS sayfası |
| GET | `/public/search` | Hayır* | Birleşik arama |
| GET | `/public/cinema` | **Evet** | Sinema listesi |
| GET | `/public/movie-sessions` | **Evet** | Seans listesi |

\*Mall gönderilmezse tenant geneli veya `mallId: null` bağlamında çalışır; mağaza/hizmet/sinema hariç.

### `GET /public/site-config`

Site meta verisi ve dil anahtarı.

**Sorgu:** `locale` (isteğe bağlı)

**Örnek yanıt (`data` özeti):**

```json
{
  "tenantId": "...",
  "tenantName": "Örnek AVM",
  "tenantSlug": "ornek-avm",
  "mallId": "...",
  "mallName": "Merkez",
  "mallSlug": "merkez",
  "location": {
    "id": "...",
    "name": "Merkez",
    "slug": "merkez",
    "phone": "+90 ...",
    "logo": { "id": "...", "url": "https://...", "width": 512, "height": 512, "alt": "Logo" },
    "address": { "line1": "...", "city": "İstanbul", "country": "TR" },
    "coordinates": { "latitude": 41.0, "longitude": 29.0 }
  },
  "supportedLocales": [
    { "code": "tr", "name": "Türkçe", "rtl": false },
    { "code": "en", "name": "English", "rtl": false }
  ],
  "defaultLocale": "tr",
  "activeLocale": "tr",
  "rtl": false
}
```

---

### `GET /public/sliders`

**Sorgu parametreleri**

| Parametre | Açıklama |
|-----------|----------|
| `placement` | `HOME`, `CAMPAIGN`, `EVENT`, `STORE`, `LOCATION`, `CUSTOM` |
| `entityId` | Entity-bound placement için bağlı kayıt ID’si |
| `channel` | `WEB`, `MOBILE`, `KIOSK`, `SIGNAGE` |
| `targetDevice` | Geriye dönük uyumluluk; filtrelenmez, yok sayılabilir |
| `locale` | Dil |

**Örnek**

```http
GET /public/sliders?placement=HOME&channel=WEB&locale=tr
```

---

### `GET /public/campaigns`

**Sorgu:** `locale`, `storeId`, `search`, `page` (varsayılan 1), `limit` (varsayılan 20, max 50)

```http
GET /public/campaigns?locale=tr&page=1&limit=12
```

**Detay:** `GET /public/campaigns/:slug`

---

### `GET /public/events`

**Sorgu:** `locale`, `category`, `search`, `page`, `limit`

```http
GET /public/events?locale=en&category=music&page=1
```

**Detay:** `GET /public/events/:slug`

---

### `GET /public/stores`

`x-mall-id` **zorunlu**.

**Sorgu:** `locale`, `categoryId`, `search`, `featuredOnly` (`true`/`false`), `page` (varsayılan 1), `limit` (varsayılan 50, max 100)

```http
GET /public/stores?featuredOnly=true&locale=tr
x-mall-id: clmall...
```

**Detay:** `GET /public/stores/:slug` — slug `globalStore.slug` üzerinden çözülür.

---

### `GET /public/services`

`x-mall-id` **zorunlu**.

**Sorgu:** `locale`, `search`, `page`, `limit`

```http
GET /public/services?search=vale&locale=tr
x-mall-id: clmall...
```

---

### `GET /public/popups`

**Sorgu:** `locale`, `channel`, `page`, `limit`

Yalnızca yayında ve tarih aralığında olan popup’lar döner.

```http
GET /public/popups?channel=WEB&locale=tr
```

---

### `GET /public/pages/:slug`

Statik veya yasal sayfalar (ör. KVKK).

**Sorgu:** `locale`

```http
GET /public/pages/kvkk?locale=tr
```

**`data` alanları (özet):**

| Alan | Açıklama |
|------|----------|
| `renderMode` | `HTML` \| `SINGLE_PDF` \| `DOCUMENT_LIST` |
| `contentHtml` | `HTML` modunda gövde |
| `attachments` | PDF/ek dosyalar |
| `blocks` | Yapılandırılmış bloklar (`type`, `dataJson`) |
| `seo` | Başlık, açıklama, anahtar kelimeler |

---

### `GET /public/search`

**Sorgu:** `q` (zorunlu, max ~120 karakter), `type` (isteğe bağlı filtre), `locale`, `page` (varsayılan 1), `limit` (varsayılan 12, max 50)

`type` değerleri: `page`, `event`, `campaign`, `store`, `movie`, `cinema` (küçük harf).

```http
GET /public/search?q=coffee&locale=tr&page=1
```

---

### `GET /public/media-guidelines`

Admin’de tanımlı görsel kullanım kuralları (önerilen boyutlar). Tenant bazlıdır; `locale` envelope için kullanılır.

```json
{
  "data": [
    {
      "usageKey": "SLIDER_DESKTOP",
      "label": "Slider Web Görseli",
      "recommendedWidth": 1920,
      "recommendedHeight": 720,
      "acceptedMimeTypes": ["image/*"],
      "helperText": null,
      "aspectRatioLocked": false
    }
  ]
}
```

---

### `GET /public/home` (isteğe bağlı kısayol)

Tek istekte ana sayfa paketi: `sliders` (HOME), `featuredStores`, `upcomingEvents`, `activeCampaigns`, `todayMovieSessions`. Mall bağlamı `x-mall-id` ile daraltılır.

---

## 5. Slider’lar

### Kavramlar

- **Slider grubu (`PublicSlider`):** Yerleşim (`placementType`), isteğe bağlı entity bağlantısı, kanal görünürlüğü, zaman penceresi (`startAt` / `endAt`).
- **Slider öğesi (`items[]`):** Her slaytta başlık, açıklama, buton, `linkUrl`, `desktopMedia` / `mobileMedia`.

### `placementType`

| Değer | Anlam |
|-------|--------|
| `HOME` | Ana sayfa hero |
| `CAMPAIGN` | Kampanya detay / listesi bağlamı |
| `EVENT` | Etkinlik bağlamı |
| `STORE` | Mağaza bağlamı |
| `LOCATION` | AVM / lokasyon bağlamı |
| `CUSTOM` | Özel yerleşim |

### `linkedEntityType` + `linkedEntityId`

Entity-bound placement’larda (`CAMPAIGN`, `EVENT`, `STORE`, `LOCATION`) slider, belirli bir kayda bağlanır:

| `placementType` | Beklenen `linkedEntityType` |
|-----------------|----------------------------|
| `CAMPAIGN` | `CAMPAIGN` |
| `EVENT` | `EVENT` |
| `STORE` | `STORE` |
| `LOCATION` | `LOCATION` |

`HOME` ve `CUSTOM` için genelde `linkedEntityType` / `linkedEntityId` `null` olur.

### Örnek sorgular

Ana sayfa (web):

```http
GET /public/sliders?placement=HOME&channel=WEB&locale=tr
```

Kampanya detay sayfası (mobil):

```http
GET /public/sliders?placement=CAMPAIGN&entityId=clcampaign123&channel=MOBILE&locale=tr
```

### Öğe yapısı (tercih edilen)

```json
{
  "id": "slider-1",
  "title": "Yaz Fırsatları",
  "placementType": "HOME",
  "linkedEntityType": null,
  "linkedEntityId": null,
  "items": [
    {
      "id": "item-1",
      "title": " %50 indirim",
      "description": "Seçili mağazalarda",
      "buttonText": "Keşfet",
      "linkUrl": "/kampanyalar/yaz",
      "desktopMedia": { "url": "https://...", "width": 1920, "height": 720, "alt": "..." },
      "mobileMedia": { "url": "https://...", "width": 768, "height": 1024, "alt": "..." },
      "sortOrder": 0,
      "status": "PUBLISHED"
    }
  ]
}
```

Kök seviyedeki `subtitle`, `desktopMedia` vb. alanlar **deprecated**; yalnızca ilk öğeden doldurulur. Yeni kodda `items[]` kullanın.

---

## 6. Medya

### `PublicMediaAsset` alanları

| Alan | Açıklama |
|------|----------|
| `id` | Medya kimliği |
| `url` | CDN/public URL (doğrudan `<img src>`) |
| `mimeType` | Örn. `image/jpeg` |
| `width`, `height` | Orijinal dosya boyutu |
| `widthOverride`, `heightOverride` | İçerik bağlamında admin’in girdiği görüntüleme boyutu (responsive `sizes` için) |
| `alt`, `caption` | Erişilebilirlik ve altyazı |
| `dominantColor` | Placeholder rengi (`#RRGGBB`) |

Görüntülerde öncelik: override varsa layout hesabında override; yoksa `width`/`height`.

### Önerilen boyutlar (`/public/media-guidelines`)

| `usageKey` | Önerilen (W×H) |
|------------|----------------|
| `SLIDER_DESKTOP` | 1920 × 720 |
| `SLIDER_MOBILE` | 768 × 1024 |
| `SLIDER_KIOSK` | 1080 × 1920 |
| `HOMEPAGE_HERO` | 1920 × 800 |
| `CAMPAIGN_COVER` | 1200 × 630 |
| `EVENT_COVER` | 1200 × 630 |
| `STORE_LOGO` | (guideline’dan) |
| `POPUP_IMAGE` | (guideline’dan) |

---

## 7. Yerelleştirme

### Locale çözümleme

1. `?locale=xx` gönderilir ve tenant’ta **aktif** bir locale ise → o dil kullanılır.
2. Geçersiz / pasif / boş → tenant **varsayılan** diline düşülür.
3. Yanıttaki `locale` alanı, envelope için çözümlenen kodu yansıtır.

Kod normalizasyonu: küçük harf, max 32 karakter (`tr`, `en`).

### Aktif diller

`GET /public/site-config` → `supportedLocales`: yalnızca `isActive: true` olanlar. Dil seçici UI bu listeyi kullanmalıdır.

### RTL

- `site-config.rtl`: aktif locale için RTL bayrağı.
- `supportedLocales[].rtl`: dil bazında.
- SDK: `isRtlLocale(code)` yardımcı fonksiyonu (`@modern-cms/public-sdk`).

Çeviri alanları entity üzerinde çözülür; eksik çeviri için API varsayılan dil içeriğine fallback yapar (resolver katmanı).

---

## 8. Kanal görünürlüğü

İçerik türlerinde (slider, kampanya, etkinlik, popup vb.) admin `channels` dizisi atar. Public API, `channel` sorgu parametresi verildiğinde **yalnızca o kanalı içeren** kayıtları döner.

| Kanal | Tipik kullanım |
|-------|----------------|
| `WEB` | Responsive web sitesi |
| `MOBILE` | Native / hybrid mobil uygulama |
| `KIOSK` | Dokunmatik kiosk |
| `SIGNAGE` | Dijital tabela / ekran ağı |

Parametre gönderilmezse kanal filtresi uygulanmaz (tüm kanallar).

---

## 9. Frontend örnekleri (fetch)

Ortam değişkenleri: `CMS_API_URL`, `CMS_TENANT_ID`, `CMS_MALL_ID`.

### Ana sayfa slider’ları

```javascript
const res = await fetch(
  `${CMS_API_URL}/public/sliders?placement=HOME&channel=WEB&locale=tr`,
  {
    headers: {
      'x-tenant-id': CMS_TENANT_ID,
      'x-mall-id': CMS_MALL_ID,
      Accept: 'application/json',
    },
  },
);
const { data: sliders } = await res.json();
// sliders[0].items → carousel
```

### Kampanya listesi

Yanıt alanları (özet):

| Alan | Açıklama |
|------|----------|
| `publishStartAt` / `publishEndAt` | CMS yayın penceresi — kayıt yalnızca bu aralıkta public listede görünür |
| `campaignStartAt` / `campaignEndAt` | Kampanya geçerlilik tarihleri — kullanıcıya gösterilir |
| `image` | İstek `locale`’ine göre çözümlenmiş kapak görseli |
| `startAt` / `endAt` | **Deprecated** — `campaignStartAt` / `campaignEndAt` ile aynı |

```javascript
const res = await fetch(
  `${CMS_API_URL}/public/campaigns?locale=tr&page=1&limit=20`,
  { headers: { 'x-tenant-id': CMS_TENANT_ID, 'x-mall-id': CMS_MALL_ID } },
);
const { data, pagination } = await res.json();
// data[0].image.url — locale-resolved cover
// data[0].campaignStartAt — validity messaging for end users
```

### Etkinlikler — tarih ve görsel

| Alan | Açıklama |
|------|----------|
| `publishStartAt` / `publishEndAt` | CMS yayın penceresi |
| `eventStartAt` / `eventEndAt` | Gerçek etkinlik zamanı (liste/detay) |
| `image` | Locale çözümlü kapak |

**Görsel fallback sırası:** istenen locale → varsayılan locale (TR) → paylaşılan görsel. Kırık referans dönülmez.

**Metin fallback:** istenen locale → varsayılan locale → boş string.

### Kampanya detay + bağlı slider’lar

```javascript
const slug = 'yaz-indirimi';
const [campaignRes, slidersRes] = await Promise.all([
  fetch(`${CMS_API_URL}/public/campaigns/${slug}?locale=tr`, { headers }),
  fetch(
    `${CMS_API_URL}/public/sliders?placement=CAMPAIGN&entityId=${campaignId}&channel=WEB&locale=tr`,
    { headers },
  ),
]);
const { data: campaign } = await campaignRes.json();
const { data: sliders } = await slidersRes.json();
// campaign.id → entityId (liste yanıtından veya detay id)
```

### Mağaza listesi

```javascript
const res = await fetch(
  `${CMS_API_URL}/public/stores?locale=tr&page=1&limit=50`,
  {
    headers: {
      'x-tenant-id': CMS_TENANT_ID,
      'x-mall-id': CMS_MALL_ID, // zorunlu
    },
  },
);
const { data: stores } = await res.json();
```

### Statik KVKK sayfası

```javascript
const res = await fetch(`${CMS_API_URL}/public/pages/kvkk?locale=tr`, { headers });
const { data: page } = await res.json();

if (page.renderMode === 'HTML') {
  // page.contentHtml — sanitize ederek render edin (DOMPurify vb.)
} else if (page.renderMode === 'SINGLE_PDF') {
  // page.attachments[0].media.url
}
```

### Popup gösterimi

```javascript
const res = await fetch(
  `${CMS_API_URL}/public/popups?channel=WEB&locale=tr&limit=10`,
  { headers },
);
const { data: popups } = await res.json();

for (const popup of popups) {
  if (popup.showOnce && localStorage.getItem(`popup:${popup.id}`)) continue;
  // modal göster; popup.closable, popup.linkUrl, popup.image
}
```

---

## 10. TypeScript — `@modern-cms/public-sdk`

Monorepo içinde workspace paketi; harici projede `file:` veya private npm ile tüketilebilir.

```typescript
import { CmsPublicClient, CmsApiError } from '@modern-cms/public-sdk';

const cms = new CmsPublicClient({
  baseUrl: process.env.CMS_API_URL!,
  tenantId: process.env.CMS_TENANT_ID!,
  mallId: process.env.CMS_MALL_ID,
  defaultLocale: 'tr',
});

// Site config
const { data: site } = await cms.getSiteConfig('tr');

// Slider
const { data: homeSliders } = await cms.getSliders({
  placement: 'HOME',
  channel: 'WEB',
  locale: 'tr',
});

// Kampanyalar
const campaigns = await cms.getCampaigns({ locale: 'tr', page: 1, limit: 20 });
const campaign = await cms.getCampaign('yaz-indirimi', 'tr');

// Kampanya slider (entityId = campaign.data.id)
const { data: campaignSliders } = await cms.getSliders({
  placement: 'CAMPAIGN',
  entityId: campaign.data.id,
  channel: 'MOBILE',
});

// Mağazalar, sayfa, popup, arama
const stores = await cms.getStores({ locale: 'tr', featuredOnly: true });
const kvkk = await cms.getPage('kvkk', 'tr');
const popups = await cms.getPopups({ channel: 'WEB', locale: 'tr' });
const search = await cms.search({ q: 'starbucks', locale: 'tr', page: 1 });

try {
  await cms.getStore('unknown-slug');
} catch (e) {
  if (e instanceof CmsApiError) {
    console.error(e.code, e.status, e.message); // NOT_FOUND, 404, ...
  }
}
```

Next.js App Router’da sunucu tarafı:

```typescript
const cms = new CmsPublicClient({
  baseUrl: process.env.CMS_API_URL!,
  tenantId: process.env.CMS_TENANT_ID!,
  mallId: process.env.CMS_MALL_ID,
  fetchImpl: fetch, // Node 18+ varsayılan
});
```

---

## 11. Önbellekleme önerileri

- Public uçlar **okuma-only** ve API tarafında Redis ile önbelleklenebilir (TTL: site-config ~300s, listeler ~120s, arama ~45s).
- Frontend’de **ISR / SSG / stale-while-revalidate** uygundur.
- Önerilen cache key bileşenleri:

```
{tenantId}:{mallId|none}:{locale|default}:{channel|all}:{endpoint}:{queryHash}
```

Örnek (Next.js `unstable_cache` veya CDN):

```
cltenant:clmall:tr:WEB:sliders:HOME
cltenant:clmall:tr:all:campaigns:p1-l20
```

`site-config` ve `media-guidelines` dil değişiminde invalidate edin. Popup’lar kısa TTL (1–5 dk) veya istemci tarafı session mantığı (`showOnce`).

---

## 12. Hata senaryoları

| Senaryo | HTTP | `message` (örnek) |
|---------|------|-------------------|
| `x-tenant-id` yok | 400 | `x-tenant-id header is required` |
| Tenant bulunamadı | 404 | `Tenant not found` |
| Tenant pasif | 400 | `Tenant is not active` |
| `x-mall-id` geçersiz | 404 | `Mall not found for this tenant` |
| AVM yayında değil | 400 | `Mall is not currently live` |
| Mağaza/hizmet uçunda mall yok | 400 | `x-mall-id header is required for the stores endpoint` |
| Slug yok | 404 | `Campaign not found` / `Page not found` |
| Geçersiz locale | — | Sessiz fallback → varsayılan dil; `locale` yanıtta varsayılan kod |

İstemci tarafında:

1. `success === false` kontrolü
2. `CmsApiError` veya `response.ok` ile ayrıştırma
3. 400 → yapılandırma hatası (env / header)
4. 404 → 404 sayfası veya boş durum

---

## Ek: SEO ve analitik

- Entity’lerde `seo` nesnesi: `title`, `description`, `keywords`, `image`. `canonicalUrl` API’de `null` — frontend `resolveCanonicalUrl(slug, baseUrl)` (SDK) ile üretin.
- İsteğe bağlı analitik olayları için SDK `buildCmsEvent` / adapter deseni; public POST uçları ayrı modülde tanımlıdır (bu rehber okuma uçlarına odaklanır).

---

*Son güncelleme: API `apps/api/src/public/public.controller.ts` ile uyumlu.*
