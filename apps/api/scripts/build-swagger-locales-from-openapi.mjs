/**
 * Builds swagger/locales/{en,tr,ru}.ts from existing openapi.json English text.
 * Run: node scripts/build-swagger-locales-from-openapi.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const specPath = join(root, 'openapi/openapi.json');

const TR = {
  Authentication: 'Kimlik Doğrulama', Users: 'Kullanıcılar', Roles: 'Roller', Permissions: 'İzinler',
  Tenants: 'Tenantlar', Malls: 'AVM\'ler', Media: 'Medya', Campaigns: 'Kampanyalar', Events: 'Etkinlikler',
  Stores: 'Mağazalar', 'Global Stores': 'Global Mağazalar', Pages: 'Sayfalar', Sliders: 'Slider\'lar',
  Popups: 'Popup\'lar', Services: 'Hizmetler', Movies: 'Filmler', Dashboard: 'Panel', Settings: 'Ayarlar',
  Search: 'Arama', 'Public API': 'Public API', Health: 'Sağlık', Version: 'Sürüm', Audit: 'Denetim',
  Analytics: 'Analitik', Notifications: 'Bildirimler', Translations: 'Çeviriler', Locales: 'Diller',
  Capabilities: 'Yetenekler', Cinemas: 'Sinemalar', 'Movie Sessions': 'Film Seansları',
  'Store Categories': 'Mağaza Kategorileri', 'Page Blocks': 'Sayfa Blokları',
  'Getting Started': 'Başlangıç', 'Identity & Access': 'Kimlik ve Erişim', Organization: 'Organizasyon',
  Content: 'İçerik', 'Commerce & Venues': 'Ticaret ve Mekanlar', Operations: 'Operasyonlar',
  List: 'Listele', Get: 'Getir', Create: 'Oluştur', Update: 'Güncelle', Delete: 'Sil',
  Publish: 'Yayınla', Archive: 'Arşivle', Upload: 'Yükle', campaign: 'kampanya', campaigns: 'kampanyalar',
  event: 'etkinlik', events: 'etkinlikler', store: 'mağaza', stores: 'mağazalar', user: 'kullanıcı',
  role: 'rol', tenant: 'tenant', mall: 'avm', media: 'medya', page: 'sayfa', slider: 'slider',
  popup: 'popup', service: 'hizmet', movie: 'film', cinema: 'sinema', location: 'lokasyon',
  notification: 'bildirim', translation: 'çeviri', locale: 'dil', audit: 'denetim', search: 'arama',
  password: 'şifre', profile: 'profil', token: 'token', login: 'giriş', readiness: 'hazırlık',
  missing: 'eksik', invalid: 'geçersiz', required: 'gerekli', permissions: 'izinler',
  'Paginated campaign list': 'Sayfalanmış kampanya listesi',
  'Campaign detail': 'Kampanya detayı', 'Campaign created': 'Kampanya oluşturuldu',
  'Missing or invalid JWT (Admin API only)': 'Eksik veya geçersiz JWT (yalnızca Admin API)',
  'Insufficient permissions or tenant/mall access denied': 'Yetersiz izin veya tenant/avm erişimi reddedildi',
  'Resource not found': 'Kaynak bulunamadı',
  'Validation error — see response body for field details': 'Doğrulama hatası — alan ayrıntıları için yanıt gövdesine bakın',
  'Missing required header or invalid query parameter': 'Gerekli header eksik veya geçersiz sorgu parametresi',
};

const RU = {
  Authentication: 'Аутентификация', Users: 'Пользователи', Roles: 'Роли', Permissions: 'Разрешения',
  Tenants: 'Тенанты', Malls: 'ТЦ', Media: 'Медиа', Campaigns: 'Кампании', Events: 'События',
  Stores: 'Магазины', 'Global Stores': 'Глобальные магазины', Pages: 'Страницы', Sliders: 'Слайдеры',
  Popups: 'Попапы', Services: 'Сервисы', Movies: 'Фильмы', Dashboard: 'Панель', Settings: 'Настройки',
  Search: 'Поиск', 'Public API': 'Public API', Health: 'Здоровье', Version: 'Версия', Audit: 'Аудит',
  Analytics: 'Аналитика', Notifications: 'Уведомления', Translations: 'Переводы', Locales: 'Языки',
  Capabilities: 'Возможности', Cinemas: 'Кинотеатры', 'Movie Sessions': 'Киносеансы',
  'Store Categories': 'Категории магазинов', 'Page Blocks': 'Блоки страниц',
  'Getting Started': 'Начало работы', 'Identity & Access': 'Идентификация и доступ',
  Organization: 'Организация', Content: 'Контент', 'Commerce & Venues': 'Коммерция и площадки',
  Operations: 'Операции', List: 'Список', Get: 'Получить', Create: 'Создать', Update: 'Обновить',
  Delete: 'Удалить', Publish: 'Опубликовать', Archive: 'Архивировать', Upload: 'Загрузить',
  campaign: 'кампания', campaigns: 'кампании', event: 'событие', events: 'события',
  store: 'магазин', stores: 'магазины', user: 'пользователь', role: 'роль', tenant: 'тенант',
  mall: 'тц', media: 'медиа', page: 'страница', service: 'сервис', movie: 'фильм', cinema: 'кинотеатр',
  missing: 'отсутствует', invalid: 'недействителен', required: 'обязательно', permissions: 'разрешения',
  'Paginated campaign list': 'Список кампаний с пагинацией',
  'Missing or invalid JWT (Admin API only)': 'Отсутствует или недействителен JWT (только Admin API)',
  'Resource not found': 'Ресурс не найден',
};

function autoTr(text) {
  if (TR[text]) return TR[text];
  let out = text;
  for (const [en, tr] of Object.entries(TR).sort((a, b) => b[0].length - a[0].length)) {
    out = out.replace(new RegExp(en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) =>
      m[0] === m[0].toUpperCase() ? tr.charAt(0).toUpperCase() + tr.slice(1) : tr,
    );
  }
  return out;
}

function autoRu(text) {
  if (RU[text]) return RU[text];
  let out = text;
  for (const [en, ru] of Object.entries(RU).sort((a, b) => b[0].length - a[0].length)) {
    out = out.replace(new RegExp(en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) =>
      m[0] === m[0].toUpperCase() ? ru.charAt(0).toUpperCase() + ru.slice(1) : ru,
    );
  }
  return out;
}

const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const en = {};

// Intro
en['intro.markdown'] = spec.info.description;
en['api.title'] = spec.info.title;

// Tags
for (const tag of spec.tags ?? []) {
  const key = `tags.${tag.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')}`;
  en[key] = tag.name;
  if (tag.description) en[`${key}.description`] = tag.description;
}

// Tag groups
for (const group of spec['x-tagGroups'] ?? []) {
  en[`tagGroup.${group.name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}.name`] = group.name;
}

// Common
en['common.permissions.label'] = '**Permissions:**';
en['common.related.label'] = '**Related:**';
en['common.requires.mallHeader'] = '**Requires** `x-mall-id` header.';
en['common.param.uuid'] = 'Resource UUID';
en['common.param.slug'] = 'URL-friendly content slug';
en['header.tenant-id.description'] = 'Tenant UUID. Required for all tenant-scoped requests.';
en['header.mall-id.description'] = 'Mall (location) UUID. Required for mall-scoped admin and public endpoints (stores, cinema, services).';
en['query.locale.description'] = 'Locale code for translated content (e.g. `tr`, `en`). Falls back to tenant default.';
en['query.channel.description'] = 'Delivery channel: `WEB`, `MOBILE`, `KIOSK`, or `DIGITAL_SIGNAGE`.';
en['query.page.description'] = 'Page number (1-based).';
en['query.limit.description'] = 'Items per page.';
en['errors.400'] = 'Bad request — missing required header or invalid query parameter';
en['errors.401'] = 'Missing or invalid JWT (Admin API only)';
en['errors.403'] = 'Insufficient permissions or tenant/mall access denied';
en['errors.404'] = 'Resource not found';
en['errors.409'] = 'Conflict — resource state prevents this operation';
en['errors.422'] = 'Validation error — see response body for field details';
en['errors.500'] = 'Internal server error';
en['security.jwt.description'] = 'Admin API JWT access token from `POST /auth/login`';
en['portal.language.label'] = 'Language';
en['portal.title'] = 'Modern CMS Developer Portal';
en['portal.description'] = 'Auto-generated from NestJS OpenAPI — single source of truth for frontend developers.';

function opKey(path, method, field) {
  const clean = path.replace(/^\//, '').replace(/\{[^}]+\}/g, 'byId').replace(/\//g, '.');
  return `${clean}.${method}.${field}`;
}

for (const [path, item] of Object.entries(spec.paths)) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const op = item[method];
    if (!op) continue;
    const base = opKey(path, method, 'summary');
    if (op.summary) {
      en[base] = op.summary;
      en[`${base.replace('.summary', '')}.summary`] = op.summary;
    }
    if (op.description && !op.description.includes('**Permissions:**')) {
      en[opKey(path, method, 'description')] = op.description.split('\n\n**')[0];
    }
    for (const [code, resp] of Object.entries(op.responses ?? {})) {
      if (resp.description) {
        en[opKey(path, method, `response.${code}`)] = resp.description;
      }
    }
  }
}

// Scan controllers for summaryKey patterns
import { readdirSync, readFileSync as read, statSync } from 'node:fs';
function walk(d, f = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, f);
    else if (e.endsWith('.controller.ts')) f.push(p);
  }
  return f;
}

for (const file of walk(join(root, 'src'))) {
  const c = read(file, 'utf8');
  for (const m of c.matchAll(/summaryKey:\s*'([^']+)'/g)) {
    if (!en[m[1]]) en[m[1]] = m[1].split('.').slice(-2).join(' ').replace(/([A-Z])/g, ' $1');
  }
  for (const m of c.matchAll(/descriptionKey:\s*'([^']+)'/g)) {
    if (!en[m[1]]) en[m[1]] = m[1];
  }
}

function writeLocale(code, data, translate) {
  const entries = Object.fromEntries(
    Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, translate(String(v))]),
  );
  const lines = [
    `/** Swagger i18n — ${code.toUpperCase()} */`,
    `export const ${code} = {`,
    ...Object.entries(entries).map(([k, v]) => `  '${k}': ${JSON.stringify(v)},`),
    '} as const;',
    '',
  ];
  writeFileSync(join(root, `src/swagger/locales/${code}.ts`), lines.join('\n'));
}

const tr = {};
const ru = {};
for (const [k, v] of Object.entries(en)) {
  tr[k] = autoTr(v);
  ru[k] = autoRu(v);
}

writeLocale('en', en, (v) => v);
writeLocale('tr', tr, (v) => v);
writeLocale('ru', ru, (v) => v);
console.log(`Built ${Object.keys(en).length} locale keys`);
