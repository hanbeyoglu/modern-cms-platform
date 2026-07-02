import type { PortalLocale } from '../i18n/portal-locales';

const RECIPES_EN = `## Recipes — real page integrations

Step-by-step guides to build a complete mall website without asking backend questions.

---

### Recipe 1: Homepage

**Goal:** Render hero, featured stores, events, campaigns and cinema in one page load.

1. **Bootstrap** — \`GET /public/site-config?locale={lang}\` with \`x-tenant-id\`. Store \`supportedLocales\`, \`defaultLocale\`, \`rtl\`.
2. **Home data** — \`GET /public/home?locale={lang}\` with \`x-tenant-id\` + \`x-mall-id\`.
3. **Map sections:**
   - \`data.sliders\` → Hero carousel (use first slider's \`items\`, respect \`targetUrl\`)
   - \`data.featuredStores\` → Store grid linking to \`/stores/{slug}\`
   - \`data.events\` → Event cards → \`/events/{slug}\`
   - \`data.campaigns\` → Offer cards → \`/campaigns/{slug}\`
   - \`data.movieSessions\` → Today's showtimes widget
4. **Popups** — after home resolves, \`GET /public/popups?locale={lang}&channel=WEB&page=1&limit=5\`. Show first undismissed modal; persist dismiss in \`localStorage\`.
5. **Loading UX** — skeleton per section; failed section should not block others.
6. **SEO** — use tenant name from site-config in \`<title>\`.

\`\`\`tsx
// pages/HomePage.tsx (simplified)
export function HomePage() {
  const { locale } = useSiteConfig();
  const { data, loading } = useHomePage(locale);
  if (loading) return <HomeSkeleton />;
  return (
    <>
      <HeroSlider items={data.sliders[0]?.items ?? []} />
      <StoreStrip stores={data.featuredStores} />
      <EventGrid events={data.events} />
      <CampaignGrid campaigns={data.campaigns} />
      <Showtimes sessions={data.movieSessions} />
      <PopupManager channel="WEB" locale={locale} />
    </>
  );
}
\`\`\`

---

### Recipe 2: Campaign detail

**Route:** \`/campaigns/:slug\`

1. Read \`slug\` from URL.
2. \`GET /public/campaigns/{slug}?locale={lang}\` — tenant header only.
3. Render: cover image (use \`coverUrl\` / responsive variants), title, description, \`terms\`, validity dates, linked \`store\` card.
4. **Store link** — if \`data.store.slug\` exists, link to \`/stores/{slug}\`.
5. **Related** — optional \`GET /public/campaigns?storeId={store.id}&limit=4\` for "More from this store".
6. **404** — API returns 404 when slug unknown or campaign inactive; show friendly page.

---

### Recipe 3: Store detail

**Route:** \`/stores/:slug\`

1. \`GET /public/stores/{slug}?locale={lang}\` with tenant + **mall** headers.
2. Render: logo, name, categories, floor, working hours, contact, map coordinates.
3. **Campaigns tab** — \`GET /public/campaigns?storeId={data.id}&locale={lang}\`.
4. **Store slider** — optional \`GET /public/sliders?placement=STORE_DETAIL&entityId={data.id}&channel=WEB&locale={lang}\`.
5. **Share** — use \`slug\` in canonical URL.

---

### Recipe 4: Search

**Component:** header search overlay or dedicated \`/search?q=\` page.

1. Debounce user input (300ms).
2. \`GET /public/search?q={query}&locale={lang}&page=1&limit=12\` — mall header if results are mall-scoped.
3. Group by \`type\`: \`MALL_STORE\`, \`CAMPAIGN\`, \`EVENT\`, \`PAGE\`, \`MOVIE\`.
4. Route mapping:
   - \`MALL_STORE\` → \`/stores/{slug}\`
   - \`CAMPAIGN\` → \`/campaigns/{slug}\`
   - \`EVENT\` → \`/events/{slug}\`
   - \`PAGE\` → \`/pages/{slug}\` or your CMS route
5. Empty state when \`data.results.length === 0\`.
6. Pagination via \`pagination.totalPages\`.

---

### Recipe 5: Header

**Data sources:** \`site-config\` + optional CMS pages.

1. On app init, load site-config once (logo, tenant name, locales).
2. **Language switcher** — change \`locale\` query on navigation or store in URL prefix \`/tr/...\`.
3. **Nav links** — static routes + dynamic from \`GET /public/pages/{slug}\` for "About" if managed in CMS.
4. **Search** — embed debounced search (Recipe 4).
5. **Mall selector** — if multi-mall tenant, switch \`x-mall-id\` and reload mall-scoped data.

\`\`\`tsx
export function SiteHeader() {
  const { config, locale, setLocale } = useSiteConfig();
  return (
    <header>
      <img src={config.logoUrl} alt={config.tenantName} />
      <nav>{/* routes */}</nav>
      <LocaleSwitcher value={locale} options={config.supportedLocales} onChange={setLocale} />
      <SearchBox />
    </header>
  );
}
\`\`\`

---

### Recipe 6: Footer

1. Load legal/static pages by slug:
   - \`GET /public/pages/privacy-policy?locale={lang}\`
   - \`GET /public/pages/terms?locale={lang}\`
2. Cache page slugs in site-config or hardcode known slugs from CMS admin.
3. Render \`renderMode === 'HTML'\` with sanitized HTML; \`PDF\` → link to \`pdfUrl\`.
4. Show address / phone from \`site-config.location\`.
5. Social links — if not in API, configure in frontend env; do not invent fields.

---

### Cross-cutting checklist

| Concern | Approach |
| --- | --- |
| Auth | Public API — no JWT |
| Errors | Check \`success: false\` envelope; handle 404 per route |
| Images | Use URLs from API; follow \`media-guidelines\` for uploads (admin) |
| RTL | \`site-config.rtl\` → \`document.dir\` |
| Mobile app | Same endpoints; set \`channel=MOBILE\` for popups/sliders |
| Kiosk | \`channel=KIOSK\` or \`DIGITAL_SIGNAGE\`; larger touch targets |`;

const RECIPES_TR = `## Tarifler — gerçek sayfa entegrasyonları

Backend'e sormadan tam bir AVM web sitesi kurmak için adım adım rehberler.

---

### Tarif 1: Ana sayfa (Homepage)

1. **Bootstrap** — \`GET /public/site-config?locale={lang}\` + \`x-tenant-id\`. Locale listesi ve RTL.
2. **Ana veri** — \`GET /public/home?locale={lang}\` + \`x-mall-id\` (zorunlu).
3. **Bölümler:** sliders → hero, featuredStores → mağaza şeridi, events, campaigns, movieSessions.
4. **Popup** — yükleme sonrası \`GET /public/popups?channel=WEB&locale={lang}\`.
5. **UX** — bölüm bazlı skeleton; bir bölüm hata verse diğerleri gösterilsin.

---

### Tarif 2: Kampanya detay

1. URL'den \`slug\` alın.
2. \`GET /public/campaigns/{slug}?locale={lang}\`
3. Kapak, açıklama, \`terms\`, mağaza kartı render edin.
4. İsteğe bağlı: \`GET /public/campaigns?storeId={id}&limit=4\`

---

### Tarif 3: Mağaza detay

1. \`GET /public/stores/{slug}\` — tenant + mall header.
2. Çalışma saatleri, kat, kategori.
3. Kampanyalar: \`GET /public/campaigns?storeId={id}\`
4. Slider: \`placement=STORE_DETAIL&entityId={id}&channel=WEB\`

---

### Tarif 4: Arama

1. 300ms debounce.
2. \`GET /public/search?q=...&locale=...\`
3. \`type\` alanına göre route: mağaza → \`/stores/{slug}\`, kampanya → \`/campaigns/{slug}\`, vb.

---

### Tarif 5: Header

1. \`site-config\` ile logo ve dil listesi.
2. Dil değişince tüm isteklerde \`locale\` güncelle.
3. Arama kutusu (Tarif 4).

---

### Tarif 6: Footer

1. \`GET /public/pages/privacy-policy\`, \`terms\` vb.
2. \`renderMode\` HTML ise sanitize edilmiş HTML.
3. Adres: \`site-config.location\`

---

### Kontrol listesi

| Konu | Yaklaşım |
| --- | --- |
| Kimlik doğrulama | JWT yok |
| RTL | \`site-config.rtl\` |
| Mobil | \`channel=MOBILE\` popup/slider için |
| Kiosk | \`channel=KIOSK\` |`;

const RECIPES_RU = `## Рецепты — интеграция страниц

---

### Рецепт 1: Главная

1. \`site-config\` при старте
2. \`GET /public/home\` с x-mall-id
3. Секции: sliders, stores, events, campaigns, cinema
4. Popups с channel=WEB

### Рецепт 2: Кампания

\`GET /public/campaigns/{slug}\`

### Рецепт 3: Магазин

\`GET /public/stores/{slug}\` + campaigns по storeId

### Рецепт 4: Поиск

Debounced \`GET /public/search\`

### Рецепт 5: Header

site-config + переключатель locale

### Рецепт 6: Footer

CMS pages по slug (privacy-policy, terms)`;

export const RECIPES_CONTENT: Record<PortalLocale, string> = {
  en: RECIPES_EN,
  tr: RECIPES_TR,
  ru: RECIPES_RU,
};

export const RECIPES_LABEL_KEY = 'developerPortal.recipes.title';

export const RECIPES_TITLES: Record<PortalLocale, string> = {
  en: 'Recipes',
  tr: 'Tarifler',
  ru: 'Рецепты',
};
