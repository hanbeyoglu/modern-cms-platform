/**
 * Frontend Developer Portal — Getting Started markdown per locale.
 * Guides website/mobile/kiosk integrators. No CMS admin documentation.
 */
export const GETTING_STARTED_MARKDOWN: Record<'tr' | 'en' | 'ru', string> = {
  en: `# Getting Started

Build AVM websites, mobile apps, kiosks and digital signage with the **Public API** (\`/public/*\`).

This portal shows **frontend integration endpoints only**. Full backend API (users, roles, tenants, media upload, audit) is in Swagger UI at \`/api/docs\`.

## Authentication

No JWT on public endpoints. Send on every request:

- \`x-tenant-id\` — tenant UUID (required)
- \`x-mall-id\` — mall UUID (required for mall-scoped content)
- \`locale\` query or \`Accept-Language\` — optional localization
- \`channel\` query — \`WEB\`, \`MOBILE\`, \`KIOSK\`, \`DIGITAL_SIGNAGE\` where supported

## SDK

\`\`\`typescript
import { CmsPublicClient } from '@modern-cms/public-sdk';

const cms = new CmsPublicClient({
  baseUrl: 'https://api.example.com',
  tenantId: 'your-tenant-id',
  mallId: 'your-mall-id',
  defaultLocale: 'tr',
});

const home = await cms.getHome({ locale: 'tr' });
\`\`\`

## Localization

1. Call \`GET /public/site-config\` on bootstrap — read \`languages\` (or \`supportedLocales\`), \`defaultLocale\`, \`rtl\`.
2. **System languages** are defined once per tenant (admin: Settings → Localization). **Location active languages** are a subset per mall — when \`x-mall-id\` is set, \`site-config\` returns only languages enabled for that location.
3. Pass \`locale=tr\` (or \`en\`, \`ru\`, …) on each request.
4. Fallback: if a translation is missing, the API returns the tenant default locale content.
5. RTL: use \`site-config\` \`rtl\` flag to flip layout direction.

## Channels

| Channel | Use case |
| --- | --- |
| WEB | Responsive website |
| MOBILE | Native / React Native / Flutter apps |
| KIOSK | In-mall touch screens |
| DIGITAL_SIGNAGE | Lobby displays |

Pass \`channel\` on sliders, popups and other channel-aware endpoints.

## Integration

### Headers

Always send \`x-tenant-id\`. Send \`x-mall-id\` for stores, cinema, services and mall-scoped lists.

### Caching

Public responses are cached server-side. Re-fetch on locale or mall change. Use short TTL for home and lists.

### Errors

| Status | Meaning |
| --- | --- |
| 400 | Missing \`x-mall-id\` or invalid query |
| 404 | Slug not found or not published |
| 500 | Server error |

### Rate limits

Use reasonable polling intervals. Prefer \`GET /public/home\` over many parallel list calls on the home screen.

## Page integration recipes

Step-by-step guides for **Homepage**, **Campaign detail**, **Store detail**, **Search**, **Header** and **Footer** live in the **Recipes** tab — including React snippets, channel/locale behavior and routing.

Each **API Reference** endpoint also includes an integration guide, request examples (cURL, fetch, Axios, SDK) and response samples.

## Next steps

1. **Recipes** — build real pages end-to-end
2. **API Reference** — browse \`/public/*\` endpoints, try the playground and search`,

  tr: `# Başlangıç

AVM web sitesi, mobil uygulama, kiosk ve digital signage geliştirmek için **Public API** (\`/public/*\`) kullanın.

Bu portal **yalnızca frontend entegrasyon uçlarını** gösterir. Tam backend API (kullanıcılar, roller, tenant, medya yükleme, audit) Swagger UI'da: \`/api/docs\`.

## Kimlik Doğrulama

Public uçlarda JWT yok. Her istekte gönderin:

- \`x-tenant-id\` — tenant UUID (zorunlu)
- \`x-mall-id\` — AVM UUID (AVM kapsamlı içerik için zorunlu)
- \`locale\` sorgusu veya \`Accept-Language\` — opsiyonel yerelleştirme
- \`channel\` sorgusu — desteklenen uçlarda \`WEB\`, \`MOBILE\`, \`KIOSK\`, \`DIGITAL_SIGNAGE\`

## SDK

\`\`\`typescript
import { CmsPublicClient } from '@modern-cms/public-sdk';

const cms = new CmsPublicClient({
  baseUrl: 'https://api.example.com',
  tenantId: 'your-tenant-id',
  mallId: 'your-mall-id',
  defaultLocale: 'tr',
});

const home = await cms.getHome({ locale: 'tr' });
\`\`\`

## Yerelleştirme

1. Bootstrap'ta \`GET /public/site-config\` — \`languages\` (veya \`supportedLocales\`), \`defaultLocale\`, \`rtl\`
2. **Sistem dilleri** tenant genelinde bir kez tanımlanır (API). **Lokasyon aktif dilleri** Ayarlar → **Diller** ekranından lokasyon seçilerek yönetilir — \`x-mall-id\` gönderildiğinde \`site-config\` yalnızca o lokasyonda etkin dilleri döner.
3. Her istekte \`locale=tr\` (veya \`en\`, \`ru\`, …)
4. Fallback: çeviri yoksa tenant varsayılan locale içeriği döner
5. RTL: \`site-config\` içindeki \`rtl\` bayrağı ile layout yönü

## Kanallar

| Kanal | Kullanım |
| --- | --- |
| WEB | Responsive web sitesi |
| MOBILE | Native / React Native / Flutter |
| KIOSK | AVM içi dokunmatik ekranlar |
| DIGITAL_SIGNAGE | Lobi ekranları |

Slider, popup ve kanal duyarlı uçlarda \`channel\` gönderin.

## Entegrasyon

### Header'lar

Her zaman \`x-tenant-id\`. Mağaza, sinema, hizmet ve AVM listeleri için \`x-mall-id\`.

### Önbellek

Public yanıtlar sunucuda önbelleklenir. Locale veya AVM değişince yeniden çekin.

### Hatalar

| Kod | Anlam |
| --- | --- |
| 400 | Eksik \`x-mall-id\` veya geçersiz sorgu |
| 404 | Slug bulunamadı veya yayında değil |
| 500 | Sunucu hatası |

### Rate limit

Makul aralıklarla istek atın. Ana sayfada çok sayıda liste yerine \`GET /public/home\` tercih edin.

## Sayfa entegrasyon tarifleri

**Ana sayfa**, **kampanya detay**, **mağaza detay**, **arama**, **header** ve **footer** için adım adım rehberler **Tarifler** sekmesindedir — React örnekleri, kanal/locale davranışı ve routing dahil.

Her **API Referansı** endpoint'inde entegrasyon rehberi, istek örnekleri (cURL, fetch, Axios, SDK) ve response örnekleri bulunur.

## Sonraki adımlar

1. **Tarifler** — gerçek sayfaları uçtan uca kurun
2. **API Referansı** — \`/public/*\` uçlarını inceleyin, playground ve aramayı kullanın`,

  ru: `# Начало работы

Создавайте сайты ТЦ, мобильные приложения, киоски и digital signage через **Public API** (\`/public/*\`).

Этот портал показывает **только эндпоинты для frontend-интеграции**. Полный backend API (пользователи, роли, tenants, загрузка медиа, audit) — в Swagger UI: \`/api/docs\`.

## Аутентификация

JWT на public эндпоинтах не нужен. На каждый запрос:

- \`x-tenant-id\` — UUID tenant (обязательно)
- \`x-mall-id\` — UUID ТЦ (для mall-scoped контента)
- \`locale\` или \`Accept-Language\` — локализация
- \`channel\` — \`WEB\`, \`MOBILE\`, \`KIOSK\`, \`DIGITAL_SIGNAGE\`

## SDK

\`\`\`typescript
import { CmsPublicClient } from '@modern-cms/public-sdk';

const cms = new CmsPublicClient({
  baseUrl: 'https://api.example.com',
  tenantId: 'your-tenant-id',
  mallId: 'your-mall-id',
  defaultLocale: 'tr',
});

const home = await cms.getHome({ locale: 'tr' });
\`\`\`

## Локализация

1. \`GET /public/site-config\` при старте — \`languages\` (или \`supportedLocales\`), \`defaultLocale\`, \`rtl\`
2. **Системные языки** задаются один раз на tenant. **Активные языки локации** — подмножество для каждого ТЦ; с \`x-mall-id\` site-config возвращает только языки, включённые для этой локации.
3. \`locale=tr\` на каждом запросе
4. Fallback — контент default locale tenant
5. RTL — флаг \`rtl\` в site-config

## Каналы

| Канал | Назначение |
| --- | --- |
| WEB | Адаптивный сайт |
| MOBILE | Native / RN / Flutter |
| KIOSK | Сенсорные киоски |
| DIGITAL_SIGNAGE | Экраны в лобби |

Передавайте \`channel\` для sliders, popups и channel-aware эндпоинтов.

## Интеграция

### Заголовки

Всегда \`x-tenant-id\`. Для stores, cinema, services — \`x-mall-id\`.

### Кэш

Ответы кэшируются на сервере. Обновляйте при смене locale или mall.

### Ошибки

| Код | Значение |
| --- | --- |
| 400 | Нет \`x-mall-id\` или неверный query |
| 404 | Slug не найден |
| 500 | Ошибка сервера |

## Рецепты страниц

Пошаговые сценарии **главной**, **кампании**, **магазина**, **поиска**, **header** и **footer** — во вкладке **Рецепты**.

Каждый эндпоинт в **Справочнике API** содержит руководство, примеры запросов (cURL, fetch, Axios, SDK) и образцы ответов.

## Далее

1. **Рецепты** — сборка страниц
2. **Справочник API** — \`/public/*\` эндпоинты`,
};
