import type { PortalLocale } from '../i18n/portal-locales';

type GuideMap = Record<string, string>;

const SHARED_HEADERS_EN = `### Required headers
- \`x-tenant-id\` — always
- \`x-mall-id\` — when noted below

### Locale
Pass \`locale=tr|en|ru\`. Missing translations fall back to tenant default from \`site-config\`.

### Channel
Where supported, \`channel=WEB|MOBILE|KIOSK|DIGITAL_SIGNAGE\` filters delivery rules (sliders, popups).`;

const SHARED_HEADERS_TR = `### Zorunlu header'lar
- \`x-tenant-id\` — her zaman
- \`x-mall-id\` — belirtildiğinde

### Locale
\`locale=tr|en|ru\` gönderin. Eksik çeviriler \`site-config\` varsayılanına düşer.

### Kanal
Desteklenen uçlarda \`channel=WEB|MOBILE|KIOSK|DIGITAL_SIGNAGE\` (slider, popup).`;

const SHARED_HEADERS_RU = `### Заголовки
- \`x-tenant-id\` — всегда
- \`x-mall-id\` — где указано

### Локаль
\`locale=tr|en|ru\`. Fallback — default locale из \`site-config\`.

### Канал
\`channel=WEB|MOBILE|KIOSK|DIGITAL_SIGNAGE\` для sliders, popups.`;

const EN: GuideMap = {
  'devGuide.public.siteConfig': `## Integration guide

### When to call
**App bootstrap** — before any screen. Cache result for the session.

### Purpose
Returns tenant/mall identity, supported locales, RTL flag, logo and address. Use to configure i18n, theme direction and navigation labels.

${SHARED_HEADERS_EN}

### Query parameters
| Param | Required | Description |
| --- | --- | --- |
| locale | No | Preferred content locale |

### Mall header
Optional — include \`x-mall-id\` to load mall-specific branding in \`location\`.

### React pattern
\`\`\`tsx
// app/providers/SiteConfigProvider.tsx
const { data } = await cms.getSiteConfig({ locale });
// set i18n language, document.dir = data.rtl ? 'rtl' : 'ltr'
\`\`\``,

  'devGuide.public.home': `## Integration guide

### When to call
**Homepage first paint** — single call instead of 4–5 parallel list requests.

### Purpose
Aggregates hero sliders, featured stores, upcoming events, active campaigns and today's cinema sessions.

${SHARED_HEADERS_EN}

### Query parameters
| Param | Required | Description |
| --- | --- | --- |
| locale | No | Content language |

### Mall header
**Required** — home content is mall-scoped.

### Channel
Not filtered on this endpoint; channel-specific popups use \`GET /public/popups\`.

### React pattern
Load once in page \`useEffect\`, split sections into presentational components. Show skeleton until \`data\` resolves.`,

  'devGuide.public.sliders': `## Integration guide

### When to call
Hero/banner areas outside the home aggregate, or entity-scoped sliders (store page).

### Query parameters
| Param | Description |
| --- | --- |
| placement | e.g. \`HOME_HERO\`, \`STORE_DETAIL\` |
| entityId | Scope slider to a store/event UUID |
| channel | **WEB / MOBILE / KIOSK / DIGITAL_SIGNAGE** — filters scheduled items |
| targetDevice | \`ALL\`, \`DESKTOP\`, \`MOBILE\` |
| locale | Content language |

### Channel behavior
Kiosk/signage often uses \`channel=KIOSK\` or \`DIGITAL_SIGNAGE\` with large image assets from the same CMS record.`,

  'devGuide.public.campaigns.list': `## Integration guide

### When to call
Campaign listing page, store detail "offers" tab, or home section if not using \`/public/home\`.

### Query parameters
| Param | Description |
| --- | --- |
| page, limit | Pagination (default 20, max 50) |
| storeId | Filter campaigns for one store |
| search | Free-text filter |
| locale | Content language |`,

  'devGuide.public.campaigns.detail': `## Integration guide

### When to call
Campaign detail page \`/campaigns/{slug}\`.

### Path
| Param | Description |
| --- | --- |
| slug | URL slug from list or search result |

### Response usage
Render \`terms\`, coupon code, linked \`store\`, cover media and SEO fields.`,

  'devGuide.public.stores.list': `## Integration guide

### When to call
Store directory, map floor list, category browse.

**Categories are mall-scoped.** Global stores have no category. Each mall defines its own taxonomy.

### Mall header
**Required**

### Query parameters
| Param | Description |
| --- | --- |
| categoryId | Filter by mall category UUID |
| search | Name/tags search |
| featuredOnly | \`true\` for homepage-style featured strip |
| page, limit | Pagination (default 50, max 100) |

### Response fields
- \`category\` — mall category with \`name\`, \`description\`, \`color\`, \`icon\`, \`cover\` (locale resolved)
- \`categories[]\` — deprecated; mirrors \`[category]\` when present
- \`name\` — global brand name (use on store cards and listing pages)
- \`detailTitle\` — optional mall-local detail page heading (use on store detail: \`detailTitle ?? name\`)
- \`description\` — mall-localized description
- \`floor\` — \`{ id, name, label }\`
- \`phone\`, \`whatsappPhone\` — branch contact (phone falls back to global)
- \`workingHours\` — structured weekly schedule
- \`globalStore\` — brand only (no category)
- \`globalStore.socialLinks\` — brand social accounts`,

  'devGuide.public.stores.detail': `## Integration guide

### When to call
Store detail \`/stores/{slug}\` (slug is global brand slug).

### Mall header
**Required**

### Response highlights
Same shape as list item, plus full \`category\` (with icon/cover), \`workingHours\`, \`floor\`, and \`globalStore.socialLinks\`.

### SDK
\`\`\`ts
const store = await client.getStore('zara', { locale: 'tr' });
\`\`\`

Combine with \`GET /public/campaigns?storeId={id}\` for store offers.`,

  'devGuide.public.events.list': `## Integration guide

### Query parameters
| Param | Description |
| --- | --- |
| category | Category slug |
| search | Title/description search |
| page, limit | Pagination |`,

  'devGuide.public.events.detail': `## Integration guide

### When to call
Event detail page. Use \`slug\` from list, search or home aggregate.`,

  'devGuide.public.pages.detail': `## Integration guide

### When to call
CMS pages: footer links, legal, FAQ, custom landing.

### Path
| Param | Description |
| --- | --- |
| slug | e.g. \`privacy-policy\`, \`terms\`, \`about\` |

### Render modes
Check \`renderMode\` — \`HTML\`, \`PDF\`, or block-based content.`,

  'devGuide.public.search': `## Integration guide

### When to call
Global search box — one endpoint for pages, events, campaigns, stores, movies.

### Query parameters
| Param | Description |
| --- | --- |
| q | Search text (max 120 chars) |
| type | Optional: \`PAGE\`, \`EVENT\`, \`CAMPAIGN\`, \`MALL_STORE\`, \`MOVIE\`, \`CINEMA\` |
| page, limit | Pagination |

Debounce input 300ms before calling.`,

  'devGuide.public.popups': `## Integration guide

### When to call
After home loads — check for modal promo.

### Channel
**Required in practice** — \`channel=WEB\` on website, \`MOBILE\` in app.

### Query
| Param | Description |
| --- | --- |
| channel | WEB / MOBILE / KIOSK / DIGITAL_SIGNAGE |
| page, limit | Pagination |`,

  'devGuide.public.cinema': `## Integration guide

### Mall header
**Required** — cinema operators are mall-scoped.`,

  'devGuide.public.movieSessions': `## Integration guide

### Query parameters
| Param | Description |
| --- | --- |
| date | \`YYYY-MM-DD\` (default today) |
| cinemaId | Filter operator |
| movieId | Filter title |
| limit | Max sessions (default 50, max 200) |

### Movie visibility and payload
Only active movies inside their publish window are returned. Each session embeds movie \`releaseDate\`, \`poster\`, \`categories\`, \`trailerUrl\`, and \`ticketUrl\` for listing/detail UIs. \`ticketUrl\` is the movie-level purchase link; render a "Buy Ticket" button only when it is present. TMDB import/resync does not populate or overwrite \`ticketUrl\`. For TMDB-backed movies, \`trailerUrl\` is populated during import/resync from the best YouTube video: official Trailer, then Trailer, then Teaser.`,

  'devGuide.public.services.list': `## Integration guide

### Mall header
**Required** — amenities (parking, baby room, Wi-Fi map points).

### Query
\`search\`, \`page\`, \`limit\`, \`locale\``,

  'devGuide.public.services.detail': `## Integration guide

### Path
\`id\` — service UUID from list or map marker.`,

  'devGuide.public.mediaGuidelines': `## Integration guide

### When to call
Reference only — shows recommended image dimensions per usage preset. Not needed at runtime for public apps unless you build upload UI (admin only).`,
};

const TR: GuideMap = {
  'devGuide.public.siteConfig': `## Entegrasyon rehberi

### Ne zaman çağrılır
**Uygulama açılışı** — ilk ekrandan önce. Oturum boyunca önbelleğe alın.

### Amaç
Tenant/AVM kimliği, desteklenen locale'ler, RTL, logo ve adres. i18n ve layout yönü için kullanın.

${SHARED_HEADERS_TR}

### Sorgu parametreleri
| Param | Zorunlu | Açıklama |
| --- | --- | --- |
| locale | Hayır | İçerik dili |

### React
\`getSiteConfig\` sonucu ile \`document.dir\` ve dil seçiciyi ayarlayın.`,

  'devGuide.public.home': `## Entegrasyon rehberi

### Ne zaman çağrılır
**Ana sayfa** — birden fazla liste isteği yerine tek çağrı.

### Amaç
Slider, öne çıkan mağazalar, etkinlikler, kampanyalar ve sinema seansları.

${SHARED_HEADERS_TR}

### AVM header
**Zorunlu** — \`x-mall-id\`

### React
Tek \`useEffect\` ile yükleyin, bölümlere ayırın, skeleton gösterin.`,

  'devGuide.public.sliders': `## Entegrasyon rehberi

### Sorgu parametreleri
| Param | Açıklama |
| --- | --- |
| placement | Örn. \`HOME_HERO\` |
| channel | WEB / MOBILE / KIOSK / DIGITAL_SIGNAGE |
| locale | İçerik dili |`,

  'devGuide.public.campaigns.list': `## Entegrasyon rehberi

Kampanya listesi ve mağaza teklifleri.

| Param | Açıklama |
| --- | --- |
| page, limit | Sayfalama |
| storeId | Mağazaya göre filtre |
| search | Metin araması |`,

  'devGuide.public.campaigns.detail': `## Entegrasyon rehberi

Kampanya detay sayfası — \`slug\` ile. \`terms\`, kupon ve mağaza bilgisini render edin.`,

  'devGuide.public.stores.list': `## Entegrasyon rehberi

Mağaza dizini. **x-mall-id zorunlu.**

| Param | Açıklama |
| --- | --- |
| categoryId | Kategori filtresi |
| featuredOnly | Öne çıkanlar |
| search | Arama |`,

  'devGuide.public.stores.detail': `## Entegrasyon rehberi

Mağaza detay — \`slug\`. Kampanyalar için \`GET /public/campaigns?storeId=\`.`,

  'devGuide.public.events.list': `## Entegrasyon rehberi

Etkinlik listesi — \`category\`, \`search\`, sayfalama.`,

  'devGuide.public.events.detail': `## Entegrasyon rehberi

Etkinlik detay — \`slug\` ile.`,

  'devGuide.public.pages.detail': `## Entegrasyon rehberi

Footer, yasal sayfalar — \`slug\` (örn. \`privacy-policy\`). \`renderMode\` kontrol edin.`,

  'devGuide.public.search': `## Entegrasyon rehberi

Global arama kutusu. \`q\` debounce 300ms. \`type\` ile filtre opsiyonel.`,

  'devGuide.public.popups': `## Entegrasyon rehberi

Ana sayfa sonrası modal. **channel=WEB** veya **MOBILE** gönderin.`,

  'devGuide.public.cinema': `## Entegrasyon rehberi

Sinema operatörleri. **x-mall-id zorunlu.**`,

  'devGuide.public.movieSessions': `## Entegrasyon rehberi

Seans listesi — \`date\`, \`cinemaId\`, \`movieId\`.

Yalnızca aktif ve yayın aralığında olan filmler döner. Seans içindeki film nesnesi \`releaseDate\`, \`poster\`, \`categories\`, \`trailerUrl\` ve \`ticketUrl\` alanlarını içerir. \`ticketUrl\` film genelindeki bilet satın alma linkidir; yalnızca doluysa "Bilet Al" butonu gösterin. TMDB içe aktarma/yeniden senkronizasyon \`ticketUrl\` alanını doldurmaz veya değiştirmez. TMDB kaynaklı filmlerde \`trailerUrl\`, içe aktarma/yeniden senkronizasyon sırasında en uygun YouTube videosundan beslenir: resmi Trailer, sonra Trailer, sonra Teaser.`,

  'devGuide.public.services.list': `## Entegrasyon rehberi

AVM hizmetleri (otopark, bebek bakımı). **x-mall-id zorunlu.**`,

  'devGuide.public.services.detail': `## Entegrasyon rehberi

Hizmet detay — UUID ile.`,

  'devGuide.public.mediaGuidelines': `## Entegrasyon rehberi

Görsel boyut referansı — genelde runtime'da gerekmez.`,
};

const RU: GuideMap = {
  'devGuide.public.siteConfig': `## Руководство по интеграции

### Когда вызывать
При старте приложения — закэшировать на сессию.

${SHARED_HEADERS_RU}`,

  'devGuide.public.home': `## Руководство по интеграции

Главная страница — один агрегирующий запрос. **x-mall-id обязателен.**`,

  'devGuide.public.sliders': `## Руководство

Параметр \`channel\` для WEB/MOBILE/KIOSK/SIGNAGE.`,

  'devGuide.public.campaigns.list': `## Руководство

Список кампаний — пагинация, storeId, search.`,

  'devGuide.public.campaigns.detail': `## Руководство

Деталь кампании по slug.`,

  'devGuide.public.stores.list': `## Руководство

Каталог магазинов. **x-mall-id обязателен.**`,

  'devGuide.public.stores.detail': `## Руководство

Деталь магазина по slug.`,

  'devGuide.public.events.list': `## Руководство

Список событий.`,

  'devGuide.public.events.detail': `## Руководство

Деталь события по slug.`,

  'devGuide.public.pages.detail': `## Руководство

CMS-страницы (footer, legal) по slug.`,

  'devGuide.public.search': `## Руководство

Глобальный поиск — debounce 300ms.`,

  'devGuide.public.popups': `## Руководство

Модальные окна — укажите channel.`,

  'devGuide.public.cinema': `## Руководство

Кинотеатры ТЦ.`,

  'devGuide.public.movieSessions': `## Руководство

Сеансы — date, cinemaId, movieId.

Возвращаются только активные фильмы в окне публикации. Объект movie содержит \`releaseDate\`, \`poster\`, \`categories\`, \`trailerUrl\` и \`ticketUrl\`. \`ticketUrl\` — общая ссылка покупки билетов для фильма; показывайте кнопку покупки только если поле заполнено. Импорт/повторная синхронизация TMDB не заполняет и не перезаписывает \`ticketUrl\`. Для фильмов TMDB \`trailerUrl\` заполняется при импорте/повторной синхронизации из лучшего YouTube-видео: official Trailer, затем Trailer, затем Teaser.`,

  'devGuide.public.services.list': `## Руководство

Сервисы ТЦ.`,

  'devGuide.public.services.detail': `## Руководство

Деталь сервиса по id.`,

  'devGuide.public.mediaGuidelines': `## Руководство

Справочник размеров медиа.`,
};

export const ENDPOINT_GUIDE_LABELS: Record<PortalLocale, GuideMap> = { en: EN, tr: TR, ru: RU };
