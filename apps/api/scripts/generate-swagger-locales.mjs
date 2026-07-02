/**
 * Generates swagger/locales/{tr,en,ru}.ts from controller i18n key usage.
 * Run: node scripts/generate-swagger-locales.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '../src');

const TR_TERMS = {
  Campaign: 'Kampanya', Campaigns: 'Kampanyalar', campaign: 'kampanya', campaigns: 'kampanyalar',
  Event: 'Etkinlik', Events: 'Etkinlikler', event: 'etkinlik', events: 'etkinlikler',
  Store: 'Mağaza', Stores: 'Mağazalar', store: 'mağaza', stores: 'mağazalar',
  User: 'Kullanıcı', Users: 'Kullanıcılar', user: 'kullanıcı', users: 'kullanıcılar',
  Role: 'Rol', Roles: 'Roller', role: 'rol', roles: 'roller',
  Tenant: 'Tenant', Tenants: 'Tenantlar', tenant: 'tenant', tenants: 'tenantlar',
  Mall: 'AVM', Malls: 'AVM\'ler', mall: 'avm', malls: 'avmler',
  Media: 'Medya', media: 'medya',
  Page: 'Sayfa', Pages: 'Sayfalar', page: 'sayfa', pages: 'sayfalar',
  Slider: 'Slider', Sliders: 'Slider\'lar', slider: 'slider', sliders: 'slider',
  Popup: 'Popup', Popups: 'Popup\'lar', popup: 'popup', popups: 'popup',
  Service: 'Hizmet', Services: 'Hizmetler', service: 'hizmet', services: 'hizmetler',
  Movie: 'Film', Movies: 'Filmler', movie: 'film', movies: 'filmler',
  Cinema: 'Sinema', Cinemas: 'Sinemalar', cinema: 'sinema', cinemas: 'sinemalar',
  Location: 'Lokasyon', Locations: 'Lokasyonlar', location: 'lokasyon', locations: 'lokasyonlar',
  Notification: 'Bildirim', Notifications: 'Bildirimler',
  Translation: 'Çeviri', Translations: 'Çeviriler',
  Locale: 'Dil', Locales: 'Diller',
  Audit: 'Denetim', Analytics: 'Analitik', Dashboard: 'Panel',
  Search: 'Arama', Settings: 'Ayarlar', Authentication: 'Kimlik Doğrulama',
  Health: 'Sağlık', Version: 'Sürüm', Permission: 'İzin', Permissions: 'İzinler',
  List: 'Listele', list: 'listele', Get: 'Getir', get: 'getir',
  Create: 'Oluştur', create: 'oluştur', Update: 'Güncelle', update: 'güncelle',
  Delete: 'Sil', delete: 'sil', Publish: 'Yayınla', publish: 'yayınla',
  Archive: 'Arşivle', archive: 'arşivle', Upload: 'Yükle', upload: 'yükle',
  by: '—', By: '—', ID: 'ID', slug: 'slug', UUID: 'UUID',
  published: 'yayınlanmış', active: 'aktif', mall: 'avm', public: 'public',
  configuration: 'yapılandırması', aggregate: 'özet', guidelines: 'kuralları',
  content: 'içerik', catalog: 'katalog', asset: 'varlık', folder: 'klasör',
  session: 'seans', sessions: 'seanslar', category: 'kategori', categories: 'kategoriler',
  password: 'şifre', profile: 'profil', token: 'token', login: 'giriş',
  readiness: 'hazırlık', probe: 'prob', liveness: 'canlılık',
};

const RU_TERMS = {
  Campaign: 'Кампания', Campaigns: 'Кампании', campaign: 'кампания', campaigns: 'кампании',
  Event: 'Событие', Events: 'События', event: 'событие', events: 'события',
  Store: 'Магазин', Stores: 'Магазины', store: 'магазин', stores: 'магазины',
  User: 'Пользователь', Users: 'Пользователи', user: 'пользователь', users: 'пользователи',
  Role: 'Роль', Roles: 'Роли', role: 'роль', roles: 'роли',
  Tenant: 'Тенант', Tenants: 'Тенанты', tenant: 'тенант', tenants: 'тенанты',
  Mall: 'ТЦ', Malls: 'ТЦ', mall: 'тц', malls: 'тц',
  Media: 'Медиа', media: 'медиа',
  Page: 'Страница', Pages: 'Страницы', page: 'страница', pages: 'страницы',
  Slider: 'Слайдер', Sliders: 'Слайдеры', slider: 'слайдер', sliders: 'слайдеры',
  Popup: 'Попап', Popups: 'Попапы', popup: 'попап', popups: 'попапы',
  Service: 'Сервис', Services: 'Сервисы', service: 'сервис', services: 'сервисы',
  Movie: 'Фильм', Movies: 'Фильмы', movie: 'фильм', movies: 'фильмы',
  Cinema: 'Кинотеатр', Cinemas: 'Кинотеатры', cinema: 'кинотеатр', cinemas: 'кинотеатры',
  Location: 'Локация', Locations: 'Локации', location: 'локация', locations: 'локации',
  Notification: 'Уведомление', Notifications: 'Уведомления',
  Translation: 'Перевод', Translations: 'Переводы',
  Locale: 'Язык', Locales: 'Языки',
  Audit: 'Аудит', Analytics: 'Аналитика', Dashboard: 'Панель',
  Search: 'Поиск', Settings: 'Настройки', Authentication: 'Аутентификация',
  Health: 'Здоровье', Version: 'Версия', Permission: 'Разрешение', Permissions: 'Разрешения',
  List: 'Список', list: 'список', Get: 'Получить', get: 'получить',
  Create: 'Создать', create: 'создать', Update: 'Обновить', update: 'обновить',
  Delete: 'Удалить', delete: 'удалить', Publish: 'Опубликовать', publish: 'опубликовать',
  Archive: 'Архивировать', archive: 'архивировать', Upload: 'Загрузить', upload: 'загрузить',
  by: 'по', By: 'По', ID: 'ID', slug: 'slug', UUID: 'UUID',
  published: 'опубликованные', active: 'активные', mall: 'тц', public: 'публичный',
  configuration: 'конфигурация', aggregate: 'агрегат', guidelines: 'правила',
  content: 'контент', catalog: 'каталог', asset: 'ресурс', folder: 'папка',
  session: 'сеанс', sessions: 'сеансы', category: 'категория', categories: 'категории',
  password: 'пароль', profile: 'профиль', token: 'токен', login: 'вход',
  readiness: 'готовность', probe: 'проба', liveness: 'живучесть',
};

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (entry.endsWith('.ts')) files.push(p);
  }
  return files;
}

function autoTranslate(text, terms) {
  let out = text;
  const sorted = Object.keys(terms).sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    out = out.replace(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), terms[word]);
  }
  return out;
}

const keys = new Set();
const en = {};

function collectFromFile(file) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(/(?:summaryKey|descriptionKey|responseKey|tagKey|nameKey):\s*['"]([^'"]+)['"]/g)) {
    keys.add(match[1]);
  }
  for (const match of content.matchAll(/I18N\.[A-Z0-9_.]+/g)) {
    // skip
  }
}

// Also scan keys.ts when exists
const keysFile = join(srcRoot, 'swagger/i18n/keys.ts');
if (statSync(keysFile, { isDirectory: false, throwIfNoEntry: false })) {
  const content = readFileSync(keysFile, 'utf8');
  for (const match of content.matchAll(/:\s*'([a-z][a-z0-9_.]+)'/g)) {
    if (match[1].includes('.')) keys.add(match[1]);
  }
}

for (const f of walk(join(srcRoot, 'swagger'))) collectFromFile(f);
for (const f of walk(srcRoot).filter((f) => f.endsWith('.controller.ts'))) collectFromFile(f);

// Fallback: read existing en if keys empty
const existingEn = join(srcRoot, 'swagger/locales/en.ts');
if (keys.size === 0 && statSync(existingEn, { throwIfNoEntry: false })) {
  console.log('No keys found yet, skipping generation');
  process.exit(0);
}

function keyToEnglish(key) {
  const parts = key.split('.');
  const last = parts[parts.length - 1];
  const resource = parts[0];
  const actionMap = {
    summary: '', list: 'List', get: 'Get', create: 'Create', update: 'Update',
    delete: 'Delete', publish: 'Publish', archive: 'Archive', upload: 'Upload',
    name: '', description: '',
  };
  if (key.startsWith('tags.')) {
    return resource.charAt(0).toUpperCase() + resource.slice(1).replace(/([A-Z])/g, ' $1');
  }
  if (key.startsWith('errors.')) {
    return `HTTP ${parts[1]} error`;
  }
  if (key.startsWith('header.') || key.startsWith('query.')) return key.replace(/\./g, ' ');
  if (key.startsWith('intro.')) return key.replace('intro.', '').replace(/([A-Z])/g, ' $1');
  if (last === 'summary') {
    const action = parts[parts.length - 2];
    const res = parts[0].replace(/-/g, ' ');
    const verbs = {
      list: `List ${res}`, get: `Get ${res} by ID`, create: `Create ${res.slice(0, -1) || res}`,
      update: `Update ${res.slice(0, -1) || res}`, delete: `Delete ${res.slice(0, -1) || res}`,
      publish: `Publish ${res.slice(0, -1) || res}`, archive: `Archive ${res.slice(0, -1) || res}`,
    };
    return verbs[action] ?? `${action} ${res}`;
  }
  if (last === '200' || last === '201' || last === '204') return `Success (${last})`;
  return key.replace(/\./g, ' ');
}

for (const key of [...keys].sort()) {
  en[key] = keyToEnglish(key);
}

function writeLocale(code, data, langLabel) {
  const lines = [`/** Auto-generated ${langLabel} Swagger translations. */`, `export const ${code} = {`];
  for (const [k, v] of Object.entries(data).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  '${k}': ${JSON.stringify(v)},`);
  }
  lines.push('} as const;', '', `export type ${code.toUpperCase()}Locale = typeof ${code};`, '');
  writeFileSync(join(srcRoot, `swagger/locales/${code}.ts`), lines.join('\n'));
}

const tr = {};
const ru = {};
for (const [k, v] of Object.entries(en)) {
  tr[k] = autoTranslate(v, TR_TERMS);
  ru[k] = autoTranslate(v, RU_TERMS);
}

writeLocale('en', en, 'English');
writeLocale('tr', tr, 'Turkish');
writeLocale('ru', ru, 'Russian');
console.log(`Generated ${Object.keys(en).length} keys for en/tr/ru`);
