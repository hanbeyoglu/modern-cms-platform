/**
 * Enhances locale files with proper EN/TR/RU translations from key patterns.
 * Run: node scripts/enhance-locale-translations.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '../src/swagger/locales');

function loadLocale(code) {
  const path = join(localesDir, `${code}.ts`);
  const content = readFileSync(path, 'utf8');
  const obj = {};
  for (const m of content.matchAll(/'([^']+)':\s*"((?:[^"\\]|\\.)*)"/g)) {
    obj[m[1]] = JSON.parse(`"${m[2]}"`);
  }
  for (const m of content.matchAll(/'([^']+)':\s*'((?:[^'\\]|\\.)*)'/g)) {
    obj[m[1]] = m[2].replace(/\\'/g, "'");
  }
  return obj;
}

const RESOURCE_EN = {
  campaign: 'campaign', event: 'event', page: 'page', popup: 'popup', slider: 'slider',
  user: 'user', role: 'role', tenant: 'tenant', mall: 'mall', location: 'location',
  media: 'media asset', movie: 'movie', cinema: 'cinema', service: 'service',
  notification: 'notification', translation: 'translation', locale: 'locale',
  capability: 'capability', globalStore: 'global store', mallStore: 'mall store',
  storeCategory: 'store category', movieSession: 'movie session', pageBlock: 'page block',
  audit: 'audit log', analytics: 'analytics', dashboard: 'dashboard', search: 'search',
  settings: 'tenant settings', access: 'access debug', auth: 'auth',
};

const RESOURCE_TR = {
  campaign: 'kampanya', event: 'etkinlik', page: 'sayfa', popup: 'popup', slider: 'slider',
  user: 'kullanıcı', role: 'rol', tenant: 'tenant', mall: 'avm', location: 'lokasyon',
  media: 'medya varlığı', movie: 'film', cinema: 'sinema', service: 'hizmet',
  notification: 'bildirim', translation: 'çeviri', locale: 'dil',
  capability: 'yetenek', globalStore: 'global mağaza', mallStore: 'avm mağazası',
  storeCategory: 'mağaza kategorisi', movieSession: 'film seansı', pageBlock: 'sayfa bloğu',
  audit: 'denetim kaydı', analytics: 'analitik', dashboard: 'panel', search: 'arama',
  settings: 'tenant ayarları', access: 'erişim debug', auth: 'kimlik doğrulama',
};

const RESOURCE_RU = {
  campaign: 'кампанию', event: 'событие', page: 'страницу', popup: 'попап', slider: 'слайдер',
  user: 'пользователя', role: 'роль', tenant: 'тенант', mall: 'ТЦ', location: 'локацию',
  media: 'медиа-ресурс', movie: 'фильм', cinema: 'кинотеатр', service: 'сервис',
  notification: 'уведомление', translation: 'перевод', locale: 'язык',
  capability: 'возможность', globalStore: 'глобальный магазин', mallStore: 'магазин ТЦ',
  storeCategory: 'категорию магазина', movieSession: 'киносеанс', pageBlock: 'блок страницы',
  audit: 'запись аудита', analytics: 'аналитику', dashboard: 'панель', search: 'поиск',
  settings: 'настройки тенанта', access: 'отладку доступа', auth: 'аутентификацию',
};

const ACTION_EN = {
  list: (r, p) => `List ${p}`, get: (r) => `Get ${r} by ID`, create: (r) => `Create ${r}`,
  update: (r) => `Update ${r}`, delete: (r) => `Delete ${r}`, publish: (r) => `Publish ${r}`,
  archive: (r) => `Archive ${r}`, upload: () => 'Upload media asset', reorder: (r) => `Reorder ${r}`,
  login: () => 'Login with email and password', refresh: () => 'Refresh access token',
  me: () => 'Get current user profile', updateProfile: () => 'Update current user profile',
  changePassword: () => 'Change current user password', health: () => 'Health check (liveness)',
  ready: () => 'Readiness probe', getVersion: () => 'API version and build metadata',
};

const ACTION_TR = {
  list: (r, p) => `${p} listele`, get: (r) => `${r} detayını getir (ID)`,
  create: (r) => `${r} oluştur`, update: (r) => `${r} güncelle`, delete: (r) => `${r} sil`,
  publish: (r) => `${r} yayınla`, archive: (r) => `${r} arşivle`, upload: () => 'Medya varlığı yükle',
  reorder: (r) => `${r} sıralamasını güncelle`, login: () => 'E-posta ve şifre ile giriş yap',
  refresh: () => 'Erişim tokenını yenile', me: () => 'Mevcut kullanıcı profilini getir',
  updateProfile: () => 'Mevcut kullanıcı profilini güncelle',
  changePassword: () => 'Mevcut kullanıcı şifresini değiştir',
  health: () => 'Sağlık kontrolü (canlılık)', ready: () => 'Hazırlık probu',
};

const ACTION_RU = {
  list: (r, p) => `Список: ${p}`, get: (r) => `Получить ${r} по ID`,
  create: (r) => `Создать ${r}`, update: (r) => `Обновить ${r}`, delete: (r) => `Удалить ${r}`,
  publish: (r) => `Опубликовать ${r}`, archive: (r) => `Архивировать ${r}`,
  upload: () => 'Загрузить медиа-ресурс', login: () => 'Вход по email и паролю',
  refresh: () => 'Обновить access token', me: () => 'Профиль текущего пользователя',
  health: () => 'Проверка работоспособности', ready: () => 'Проба готовности',
};

const PLURAL_EN = {
  campaign: 'campaigns', event: 'events', page: 'pages', popup: 'popups', slider: 'sliders',
  user: 'users', role: 'roles', tenant: 'tenants', mall: 'malls', media: 'media assets',
  movie: 'movies', cinema: 'cinemas', service: 'services', notification: 'notifications',
  translation: 'translations', locale: 'locales', capability: 'capabilities',
  globalStore: 'global stores', mallStore: 'mall stores', storeCategory: 'store categories',
  movieSession: 'movie sessions', pageBlock: 'page blocks', audit: 'audit logs',
};

const PLURAL_TR = {
  campaign: 'kampanyalar', event: 'etkinlikler', page: 'sayfalar', popup: 'popup\'lar',
  slider: 'slider\'lar', user: 'kullanıcılar', role: 'roller', tenant: 'tenantlar',
  mall: 'avmler', media: 'medya varlıkları', movie: 'filmler', cinema: 'sinemalar',
  service: 'hizmetler', notification: 'bildirimler', translation: 'çeviriler',
  locale: 'diller', capability: 'yetenekler', globalStore: 'global mağazalar',
  mallStore: 'avm mağazaları', storeCategory: 'mağaza kategorileri',
  movieSession: 'film seansları', pageBlock: 'sayfa blokları', audit: 'denetim kayıtları',
};

const PLURAL_RU = {
  campaign: 'кампании', event: 'события', page: 'страницы', popup: 'попапы',
  slider: 'слайдеры', user: 'пользователи', role: 'роли', tenant: 'тенанты',
  mall: 'ТЦ', media: 'медиа-ресурсы', movie: 'фильмы', cinema: 'кинотеатры',
  service: 'сервисы', notification: 'уведомления', locale: 'языки',
};

const TAGS_EN = {
  'tags.authentication': 'Authentication', 'tags.users': 'Users', 'tags.roles': 'Roles',
  'tags.permissions': 'Permissions', 'tags.tenants': 'Tenants', 'tags.malls': 'Malls',
  'tags.media': 'Media', 'tags.campaigns': 'Campaigns', 'tags.events': 'Events',
  'tags.stores': 'Stores', 'tags.global.stores': 'Global Stores', 'tags.pages': 'Pages',
  'tags.sliders': 'Sliders', 'tags.popups': 'Popups', 'tags.services': 'Services',
  'tags.movies': 'Movies', 'tags.dashboard': 'Dashboard', 'tags.settings': 'Settings',
  'tags.search': 'Search', 'tags.public.api': 'Public API', 'tags.health': 'Health',
  'tags.version': 'Version', 'tags.audit': 'Audit', 'tags.analytics': 'Analytics',
  'tags.notifications': 'Notifications', 'tags.translations': 'Translations',
  'tags.locales': 'Locales', 'tags.capabilities': 'Capabilities', 'tags.cinemas': 'Cinemas',
  'tags.movie.sessions': 'Movie Sessions', 'tags.store.categories': 'Store Categories',
  'tags.page.blocks': 'Page Blocks',
};

const TAGS_TR = {
  'tags.authentication': 'Kimlik Doğrulama', 'tags.users': 'Kullanıcılar', 'tags.roles': 'Roller',
  'tags.permissions': 'İzinler', 'tags.tenants': 'Tenantlar', 'tags.malls': 'AVM\'ler',
  'tags.media': 'Medya', 'tags.campaigns': 'Kampanyalar', 'tags.events': 'Etkinlikler',
  'tags.stores': 'Mağazalar', 'tags.global.stores': 'Global Mağazalar', 'tags.pages': 'Sayfalar',
  'tags.sliders': 'Slider\'lar', 'tags.popups': 'Popup\'lar', 'tags.services': 'Hizmetler',
  'tags.movies': 'Filmler', 'tags.dashboard': 'Panel', 'tags.settings': 'Ayarlar',
  'tags.search': 'Arama', 'tags.public.api': 'Public API', 'tags.health': 'Sağlık',
  'tags.version': 'Sürüm', 'tags.audit': 'Denetim', 'tags.analytics': 'Analitik',
  'tags.notifications': 'Bildirimler', 'tags.translations': 'Çeviriler', 'tags.locales': 'Diller',
  'tags.capabilities': 'Yetenekler', 'tags.cinemas': 'Sinemalar',
  'tags.movie.sessions': 'Film Seansları', 'tags.store.categories': 'Mağaza Kategorileri',
  'tags.page.blocks': 'Sayfa Blokları',
};

const TAGS_RU = {
  ...TAGS_EN,
  'tags.authentication': 'Аутентификация', 'tags.users': 'Пользователи', 'tags.roles': 'Роли',
  'tags.campaigns': 'Кампании', 'tags.events': 'События', 'tags.stores': 'Магазины',
  'tags.malls': 'ТЦ', 'tags.media': 'Медиа', 'tags.search': 'Поиск', 'tags.health': 'Здоровье',
  'tags.settings': 'Настройки', 'tags.pages': 'Страницы', 'tags.sliders': 'Слайдеры',
};

const INTRO = {
  en: loadIntro('en'),
  tr: loadIntro('tr'),
  ru: loadIntro('ru'),
};

function loadIntro(lang) {
  const texts = {
    en: `# Modern CMS Developer Portal

Headless CMS for multi-tenant, multi-mall retail and entertainment venues.

## Architecture

| Layer | Description |
|-------|-------------|
| **Admin API** | JWT-protected REST API for the React Admin panel |
| **Public API** | Headless content API for customer-facing apps |
| **Multi Tenant** | Every request scoped via \`x-tenant-id\` |
| **Multi Mall** | Mall-scoped content via \`x-mall-id\` |
| **Locale** | Content localization via \`locale\` query or \`Accept-Language\` |
| **Channel** | \`WEB\`, \`MOBILE\`, \`KIOSK\`, \`DIGITAL_SIGNAGE\` |

## Authentication

### Admin API
\`Authorization: Bearer <token>\` — required except login, refresh, public routes, health, version.

### Public API
No JWT. Use \`x-tenant-id\` and \`x-mall-id\` headers.

## Public SDK

\`\`\`typescript
import { CmsPublicClient } from '@modern-cms/public-sdk';
const cms = new CmsPublicClient({ baseUrl, tenantId, mallId, defaultLocale: 'tr' });
const campaigns = await cms.getCampaigns({ locale: 'tr', channel: 'WEB' });
\`\`\``,
    tr: `# Modern CMS Geliştirici Portalı

Çok kiracılı, çok AVM'li perakende ve eğlence mekanları için headless CMS.

## Mimari

| Katman | Açıklama |
|--------|----------|
| **Admin API** | React Admin paneli için JWT korumalı REST API |
| **Public API** | Müşteri uygulamaları için headless içerik API'si |
| **Multi Tenant** | Her istek \`x-tenant-id\` ile kapsamlanır |
| **Multi Mall** | AVM kapsamlı içerik için \`x-mall-id\` |
| **Locale** | \`locale\` sorgusu veya \`Accept-Language\` ile yerelleştirme |
| **Channel** | \`WEB\`, \`MOBILE\`, \`KIOSK\`, \`DIGITAL_SIGNAGE\` |

## Kimlik Doğrulama

### Admin API
\`Authorization: Bearer <token>\` — login, refresh, public, health, version hariç zorunlu.

### Public API
JWT yok. \`x-tenant-id\` ve \`x-mall-id\` header'larını kullanın.

## Public SDK

\`\`\`typescript
import { CmsPublicClient } from '@modern-cms/public-sdk';
const cms = new CmsPublicClient({ baseUrl, tenantId, mallId, defaultLocale: 'tr' });
const campaigns = await cms.getCampaigns({ locale: 'tr', channel: 'WEB' });
\`\`\``,
    ru: `# Портал разработчика Modern CMS

Headless CMS для мультитenant retail и развлекательных площадок.

## Архитектура

| Слой | Описание |
|------|----------|
| **Admin API** | REST API с JWT для React Admin |
| **Public API** | Headless API для клиентских приложений |
| **Multi Tenant** | Каждый запрос через \`x-tenant-id\` |
| **Multi Mall** | Контент ТЦ через \`x-mall-id\` |
| **Locale** | Локализация через \`locale\` или \`Accept-Language\` |
| **Channel** | \`WEB\`, \`MOBILE\`, \`KIOSK\`, \`DIGITAL_SIGNAGE\` |

## Аутентификация

### Admin API
\`Authorization: Bearer <token>\` — обязателен, кроме login, refresh, public, health, version.

### Public API
Без JWT. Используйте заголовки \`x-tenant-id\` и \`x-mall-id\`.

## Public SDK

\`\`\`typescript
import { CmsPublicClient } from '@modern-cms/public-sdk';
const cms = new CmsPublicClient({ baseUrl, tenantId, mallId, defaultLocale: 'tr' });
const campaigns = await cms.getCampaigns({ locale: 'tr', channel: 'WEB' });
\`\`\``,
  };
  return texts[lang];
}

const ERRORS = {
  en: {
    'errors.400': 'Bad request — missing required header or invalid query parameter',
    'errors.401': 'Missing or invalid JWT (Admin API only)',
    'errors.403': 'Insufficient permissions or tenant/mall access denied',
    'errors.404': 'Resource not found',
    'errors.409': 'Conflict — resource state prevents this operation',
    'errors.422': 'Validation error — see response body for field details',
    'errors.500': 'Internal server error',
  },
  tr: {
    'errors.400': 'Geçersiz istek — gerekli header eksik veya sorgu parametresi hatalı',
    'errors.401': 'Eksik veya geçersiz JWT (yalnızca Admin API)',
    'errors.403': 'Yetersiz izin veya tenant/AVM erişimi reddedildi',
    'errors.404': 'Kaynak bulunamadı',
    'errors.409': 'Çakışma — kaynak durumu işlemi engelliyor',
    'errors.422': 'Doğrulama hatası — alan ayrıntıları için yanıt gövdesine bakın',
    'errors.500': 'Sunucu hatası',
  },
  ru: {
    'errors.400': 'Неверный запрос — отсутствует заголовок или неверный параметр',
    'errors.401': 'Отсутствует или недействителен JWT (только Admin API)',
    'errors.403': 'Недостаточно прав или доступ к tenant/ТЦ запрещён',
    'errors.404': 'Ресурс не найден',
    'errors.409': 'Конфликт — состояние ресурса не позволяет операцию',
    'errors.422': 'Ошибка валидации — см. тело ответа',
    'errors.500': 'Внутренняя ошибка сервера',
  },
};

const PUBLIC_EN = {
  'public.siteConfig.summary': 'Get site configuration',
  'public.home.summary': 'Get home page aggregate',
  'public.sliders.summary': 'List active sliders',
  'public.events.summary': 'List published events',
  'public.event.getBySlug.summary': 'Get event by slug',
  'public.campaigns.summary': 'List published campaigns',
  'public.campaign.getBySlug.summary': 'Get campaign by slug',
  'public.stores.summary': 'List mall stores',
  'public.store.getBySlug.summary': 'Get store by slug',
  'public.page.getBySlug.summary': 'Get CMS page by slug',
  'public.cinemas.summary': 'List cinemas in mall',
  'public.movieSessions.summary': 'List movie sessions',
  'public.popups.summary': 'List active popups',
  'public.services.summary': 'List mall services',
  'public.service.getById.summary': 'Get service by ID',
  'public.search.summary': 'Search public content',
  'public.mediaGuidelines.summary': 'Get media upload guidelines',
};

const PUBLIC_TR = {
  'public.siteConfig.summary': 'Site yapılandırmasını getir',
  'public.home.summary': 'Ana sayfa özet verisini getir',
  'public.sliders.summary': 'Aktif slider\'ları listele',
  'public.events.summary': 'Yayınlanmış etkinlikleri listele',
  'public.event.getBySlug.summary': 'Slug ile etkinlik detayı',
  'public.campaigns.summary': 'Yayınlanmış kampanyaları listele',
  'public.campaign.getBySlug.summary': 'Slug ile kampanya detayı',
  'public.stores.summary': 'AVM mağazalarını listele',
  'public.store.getBySlug.summary': 'Slug ile mağaza detayı',
  'public.page.getBySlug.summary': 'Slug ile CMS sayfa detayı',
  'public.cinemas.summary': 'AVM sinemalarını listele',
  'public.movieSessions.summary': 'Film seanslarını listele',
  'public.popups.summary': 'Aktif popup\'ları listele',
  'public.services.summary': 'AVM hizmetlerini listele',
  'public.service.getById.summary': 'ID ile hizmet detayı',
  'public.search.summary': 'Public içerik araması',
  'public.mediaGuidelines.summary': 'Medya yükleme kurallarını getir',
};

const PUBLIC_RU = {
  'public.siteConfig.summary': 'Получить конфигурацию сайта',
  'public.home.summary': 'Агрегат главной страницы',
  'public.sliders.summary': 'Список активных слайдеров',
  'public.events.summary': 'Список опубликованных событий',
  'public.event.getBySlug.summary': 'Событие по slug',
  'public.campaigns.summary': 'Список опубликованных кампаний',
  'public.campaign.getBySlug.summary': 'Кампания по slug',
  'public.stores.summary': 'Список магазинов ТЦ',
  'public.store.getBySlug.summary': 'Магазин по slug',
  'public.page.getBySlug.summary': 'CMS-страница по slug',
  'public.cinemas.summary': 'Кинотеатры ТЦ',
  'public.movieSessions.summary': 'Киносеансы',
  'public.popups.summary': 'Активные попапы',
  'public.services.summary': 'Сервисы ТЦ',
  'public.service.getById.summary': 'Сервис по ID',
  'public.search.summary': 'Поиск публичного контента',
  'public.mediaGuidelines.summary': 'Правила загрузки медиа',
};

function summaryFromKey(key, lang) {
  if (PUBLIC_EN[key]) {
    return { en: PUBLIC_EN[key], tr: PUBLIC_TR[key], ru: PUBLIC_RU[key] }[lang];
  }
  const m = key.match(/^([a-zA-Z]+)\.([a-zA-Z]+)\.summary$/);
  if (!m) return null;
  const [, resource, action] = m;
  const RES = { en: RESOURCE_EN, tr: RESOURCE_TR, ru: RESOURCE_RU }[lang];
  const ACT = { en: ACTION_EN, tr: ACTION_TR, ru: ACTION_RU }[lang];
  const PL = { en: PLURAL_EN, tr: PLURAL_TR, ru: PLURAL_RU }[lang];
  const r = RES[resource] ?? resource;
  const p = PL[resource] ?? `${r}s`;
  const fn = ACT[action];
  if (!fn) return null;
  return fn(r, p);
}

function enhance(obj, lang) {
  const out = { ...obj };
  out['intro.markdown'] = INTRO[lang];
  out['api.title'] = lang === 'tr' ? 'Modern CMS API' : lang === 'ru' ? 'Modern CMS API' : 'Modern CMS API';
  out['common.permissions.label'] = lang === 'tr' ? '**İzinler:**' : lang === 'ru' ? '**Разрешения:**' : '**Permissions:**';
  out['common.related.label'] = lang === 'tr' ? '**İlgili:**' : lang === 'ru' ? '**Связанное:**' : '**Related:**';
  out['common.requires.mallHeader'] = lang === 'tr' ? '**Gerekli:** `x-mall-id` header.' : lang === 'ru' ? '**Требуется** заголовок `x-mall-id`.' : '**Requires** `x-mall-id` header.';
  out['portal.language.label'] = lang === 'tr' ? 'Dil' : lang === 'ru' ? 'Язык' : 'Language';
  Object.assign(out, ERRORS[lang]);
  Object.assign(out, lang === 'en' ? TAGS_EN : lang === 'tr' ? TAGS_TR : TAGS_RU);
  if (lang === 'en') Object.assign(out, PUBLIC_EN);
  if (lang === 'tr') Object.assign(out, PUBLIC_TR);
  if (lang === 'ru') Object.assign(out, PUBLIC_RU);

  for (const key of Object.keys(obj)) {
    if (key.endsWith('.summary')) {
      const t = summaryFromKey(key, lang);
      if (t) out[key] = t;
    }
    if (key.endsWith('.response.200')) out[key] = lang === 'tr' ? 'Başarılı yanıt' : lang === 'ru' ? 'Успешный ответ' : 'Successful response';
    if (key.endsWith('.response.201')) out[key] = lang === 'tr' ? 'Kaynak oluşturuldu' : lang === 'ru' ? 'Ресурс создан' : 'Resource created';
    if (key.endsWith('.response.204')) out[key] = lang === 'tr' ? 'Kaynak silindi' : lang === 'ru' ? 'Ресурс удалён' : 'Resource deleted';
  }

  out['tagGroup.gettingStarted.name'] = lang === 'tr' ? 'Başlangıç' : lang === 'ru' ? 'Начало работы' : 'Getting Started';
  out['tagGroup.identityAccess.name'] = lang === 'tr' ? 'Kimlik ve Erişim' : lang === 'ru' ? 'Идентификация и доступ' : 'Identity & Access';
  out['tagGroup.organization.name'] = lang === 'tr' ? 'Organizasyon' : lang === 'ru' ? 'Организация' : 'Organization';
  out['tagGroup.content.name'] = lang === 'tr' ? 'İçerik' : lang === 'ru' ? 'Контент' : 'Content';
  out['tagGroup.commerce.name'] = lang === 'tr' ? 'Ticaret ve Mekanlar' : lang === 'ru' ? 'Коммерция и площадки' : 'Commerce & Venues';
  out['tagGroup.operations.name'] = lang === 'tr' ? 'Operasyonlar' : lang === 'ru' ? 'Операции' : 'Operations';

  return out;
}

function writeLocale(code, data) {
  const lines = [`/** Swagger i18n — ${code.toUpperCase()} */`, `export const ${code} = {`];
  for (const [k, v] of Object.entries(data).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  '${k}': ${JSON.stringify(v)},`);
  }
  lines.push('} as const;', '');
  writeFileSync(join(localesDir, `${code}.ts`), lines.join('\n'));
}

for (const code of ['en', 'tr', 'ru']) {
  const base = loadLocale(code);
  writeLocale(code, enhance(base, code));
}
console.log('Enhanced en/tr/ru locale files');
