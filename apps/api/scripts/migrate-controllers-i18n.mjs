/**
 * Migrates controller swagger decorators from hardcoded strings to i18n keys.
 * Run once: node scripts/migrate-controllers-i18n.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '../src');

const RESOURCE_MAP = {
  campaigns: 'campaign',
  events: 'event',
  pages: 'page',
  popups: 'popup',
  sliders: 'slider',
  users: 'user',
  roles: 'role',
  tenants: 'tenant',
  malls: 'mall',
  locations: 'location',
  media: 'media',
  movies: 'movie',
  cinemas: 'cinema',
  services: 'service',
  notifications: 'notification',
  translations: 'translation',
  locales: 'locale',
  capabilities: 'capability',
  'global-stores': 'globalStore',
  'mall-stores': 'mallStore',
  'store-categories': 'storeCategory',
  'movie-sessions': 'movieSession',
  'page-blocks': 'pageBlock',
  'audit-logs': 'audit',
  auth: 'auth',
  health: 'health',
  version: 'version',
  dashboard: 'dashboard',
  search: 'search',
  analytics: 'analytics',
  public: 'public',
};

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (entry.endsWith('.controller.ts')) files.push(p);
  }
  return files;
}

function inferResource(filePath) {
  const parts = filePath.split('/');
  const idx = parts.indexOf('src');
  const segment = parts[idx + 1] ?? '';
  return RESOURCE_MAP[segment] ?? segment.replace(/-/g, '');
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 60);
}

function summaryToKey(resource, summary) {
  const s = summary.toLowerCase();
  if (resource === 'public') {
    if (s.includes('site config')) return 'public.siteConfig.summary';
    if (s.includes('media') && s.includes('guideline')) return 'public.mediaGuidelines.summary';
    if (s.includes('home')) return 'public.home.summary';
    if (s.includes('slider')) return 'public.sliders.summary';
    if (s.includes('event') && s.includes('slug')) return 'public.event.getBySlug.summary';
    if (s.includes('list') && s.includes('event')) return 'public.events.summary';
    if (s.includes('campaign') && s.includes('slug')) return 'public.campaign.getBySlug.summary';
    if (s.includes('list') && s.includes('campaign')) return 'public.campaigns.summary';
    if (s.includes('store') && s.includes('slug')) return 'public.store.getBySlug.summary';
    if (s.includes('list') && s.includes('store')) return 'public.stores.summary';
    if (s.includes('page') && s.includes('slug')) return 'public.page.getBySlug.summary';
    if (s.includes('cinema')) return 'public.cinemas.summary';
    if (s.includes('movie session')) return 'public.movieSessions.summary';
    if (s.includes('popup')) return 'public.popups.summary';
    if (s.includes('service') && s.includes('id')) return 'public.service.getById.summary';
    if (s.includes('list') && s.includes('service')) return 'public.services.summary';
    if (s.includes('search')) return 'public.search.summary';
    return `public.${slugify(summary)}.summary`;
  }
  if (resource === 'auth') {
    if (s.includes('login')) return 'auth.login.summary';
    if (s.includes('refresh')) return 'auth.refresh.summary';
    if (s.includes('profile') && s.includes('update')) return 'auth.updateProfile.summary';
    if (s.includes('profile') || s.includes('current user')) return 'auth.me.summary';
    if (s.includes('password')) return 'auth.changePassword.summary';
    return `auth.${slugify(summary)}.summary`;
  }
  if (resource === 'health') {
    if (s.includes('ready')) return 'health.ready.summary';
    return 'health.health.summary';
  }
  if (resource === 'version') return 'version.get.summary';

  const verbs = [
    ['list', 'list'], ['get', 'get'], ['create', 'create'], ['update', 'update'],
    ['delete', 'delete'], ['publish', 'publish'], ['archive', 'archive'], ['upload', 'upload'],
    ['clone', 'clone'], ['reorder', 'reorder'], ['track', 'track'],
  ];
  for (const [word, action] of verbs) {
    if (s.startsWith(word + ' ') || s.includes(' ' + word + ' ')) {
      return `${resource}.${action}.summary`;
    }
  }
  return `${resource}.${slugify(summary)}.summary`;
}

function migrateFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  if (content.includes('summaryKey:')) return false;

  const resource = inferResource(filePath);
  let changed = false;

  content = content.replace(
    /@ApiAdminOperation\(\{\s*summary:\s*'([^']+)'([^}]*)\}\)/g,
    (_m, summary, rest) => {
      changed = true;
      return `@ApiAdminOperation({ summaryKey: '${summaryToKey(resource, summary)}'${rest}})`;
    },
  );

  content = content.replace(
    /@ApiPublicOperation\(\{\s*summary:\s*'([^']+)'([^}]*)\}\)/g,
    (_m, summary, rest) => {
      changed = true;
      return `@ApiPublicOperation({ summaryKey: '${summaryToKey('public', summary)}'${rest}})`;
    },
  );

  content = content.replace(
    /@ApiOperation\(\{([^}]*?)summary:\s*'([^']+)'/g,
    (_m, before, summary) => {
      changed = true;
      return `@ApiOperation({${before}summaryKey: '${summaryToKey(resource, summary)}'`;
    },
  );

  content = content.replace(
    /@ApiResponse\(\{\s*status:\s*(\d+),\s*description:\s*'([^']+)'/g,
    (_m, status) => {
      changed = true;
      return `@ApiResponse({ status: ${status}, descriptionKey: '${resource}.response.${status}'`;
    },
  );

  content = content.replace(
    /@ApiUuidParam\('([^']+)',\s*'[^']+'\)/g,
    (_m, name) => {
      changed = true;
      return `@ApiUuidParam('${name}', 'common.param.uuid')`;
    },
  );

  if (changed) writeFileSync(filePath, content);
  return changed;
}

let count = 0;
for (const f of walk(srcRoot)) {
  if (migrateFile(f)) {
    count++;
    console.log('Migrated', basename(f));
  }
}
console.log(`Done: ${count} files`);
