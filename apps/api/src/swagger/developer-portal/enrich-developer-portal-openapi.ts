import type { OpenAPIObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { buildPublicCodeSamples, buildReactHookSample } from './code-samples.util';
import { ENDPOINT_GUIDE_KEY_BY_ROUTE, routeKey } from './endpoint-guide-keys';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface RouteSampleConfig {
  query?: Record<string, string>;
  sdkMethod?: string;
  sdkArgs?: string;
  reactHook?: string;
  reactFetch?: string;
}

const ROUTE_SAMPLES: Record<string, RouteSampleConfig> = {
  'GET /public/site-config': { sdkMethod: 'getSiteConfig' },
  'GET /public/media-guidelines': { sdkMethod: 'getMediaGuidelines' },
  'GET /public/home': {
    sdkMethod: 'getHome',
    reactHook: 'useHomePage',
    reactFetch: `const res = await fetch('/public/home?locale=tr', { headers: { 'x-tenant-id': TENANT_ID, 'x-mall-id': MALL_ID } });
        const json = await res.json();`,
  },
  'GET /public/sliders': {
    query: { locale: 'tr', channel: 'WEB', placement: 'HOME_HERO' },
    sdkMethod: 'getSliders',
    sdkArgs: "{ locale: 'tr', channel: 'WEB', placement: 'HOME_HERO' }",
  },
  'GET /public/events': {
    query: { locale: 'tr', page: '1', limit: '20' },
    sdkMethod: 'getEvents',
    sdkArgs: "{ locale: 'tr', page: 1, limit: 20 }",
  },
  'GET /public/events/{slug}': {
    sdkMethod: 'getEventBySlug',
    sdkArgs: "{ slug: 'summer-festival', locale: 'tr' }",
  },
  'GET /public/campaigns': {
    query: { locale: 'tr', page: '1', limit: '20' },
    sdkMethod: 'getCampaigns',
    sdkArgs: "{ locale: 'tr', page: 1, limit: 20 }",
  },
  'GET /public/campaigns/{slug}': {
    sdkMethod: 'getCampaignBySlug',
    sdkArgs: "{ slug: 'black-friday', locale: 'tr' }",
  },
  'GET /public/stores': {
    query: { locale: 'tr', page: '1', limit: '50' },
    sdkMethod: 'getStores',
    sdkArgs: "{ locale: 'tr', page: 1, limit: 50 }",
  },
  'GET /public/stores/{slug}': {
    sdkMethod: 'getStoreBySlug',
    sdkArgs: "{ slug: 'zara', locale: 'tr' }",
  },
  'GET /public/pages/{slug}': {
    sdkMethod: 'getPageBySlug',
    sdkArgs: "{ slug: 'privacy-policy', locale: 'tr' }",
  },
  'GET /public/cinema': { sdkMethod: 'getCinemas' },
  'GET /public/movie-sessions': {
    query: { locale: 'tr', date: '2026-06-27' },
    sdkMethod: 'getMovieSessions',
    sdkArgs: "{ locale: 'tr', date: '2026-06-27' }",
  },
  'GET /public/popups': {
    query: { locale: 'tr', channel: 'WEB', page: '1', limit: '20' },
    sdkMethod: 'getPopups',
    sdkArgs: "{ locale: 'tr', channel: 'WEB' }",
  },
  'GET /public/services': {
    query: { locale: 'tr', page: '1', limit: '50' },
    sdkMethod: 'getServices',
    sdkArgs: "{ locale: 'tr', page: 1, limit: 50 }",
  },
  'GET /public/services/{id}': {
    sdkMethod: 'getServiceById',
    sdkArgs: "{ id: 'service-uuid', locale: 'tr' }",
  },
  'GET /public/search': {
    query: { locale: 'tr', q: 'zara', page: '1', limit: '12' },
    sdkMethod: 'search',
    sdkArgs: "{ q: 'zara', locale: 'tr', page: 1, limit: 12 }",
  },
};

const ENVELOPE = {
  success: true,
  locale: 'tr',
  tenant: { id: '550e8400-e29b-41d4-a716-446655440000', mallId: '660e8400-e29b-41d4-a716-446655440001' },
};

const RESPONSE_EXAMPLES: Record<string, unknown> = {
  'GET /public/site-config': {
    ...ENVELOPE,
    data: {
      tenantId: ENVELOPE.tenant.id,
      tenantName: 'Demo AVM',
      mallId: ENVELOPE.tenant.mallId,
      supportedLocales: [{ code: 'tr', name: 'Türkçe', rtl: false }],
      defaultLocale: 'tr',
      activeLocale: 'tr',
      rtl: false,
    },
  },
  'GET /public/home': {
    ...ENVELOPE,
    data: {
      sliders: [{ id: '...', title: 'Hero', items: [] }],
      featuredStores: [{ slug: 'zara', name: 'Zara' }],
      events: [{ slug: 'summer-fest', title: 'Summer Festival' }],
      campaigns: [{ slug: 'sale-50', title: '%50 İndirim' }],
      movieSessions: [],
    },
  },
  'GET /public/campaigns': {
    ...ENVELOPE,
    pagination: { page: 1, limit: 20, total: 42, totalPages: 3 },
    data: [{ slug: 'black-friday', title: 'Black Friday', storeName: 'Zara' }],
  },
  'GET /public/campaigns/{slug}': {
    ...ENVELOPE,
    data: {
      slug: 'black-friday',
      title: 'Black Friday',
      description: '...',
      terms: '...',
      store: { slug: 'zara', name: 'Zara' },
    },
  },
  'GET /public/stores': {
    ...ENVELOPE,
    pagination: { page: 1, limit: 50, total: 120, totalPages: 3 },
    data: [{
      id: 'store-uuid',
      name: 'Zara',
      detailTitle: 'Zara — Mall of İstanbul',
      description: 'Moda mağazası',
      floor: { id: 'floor-uuid', name: '2', label: '2. Kat' },
      phone: '+90 212 555 0000',
      whatsappPhone: '+90 532 555 0000',
      workingHours: { monday: { open: true, from: '10:00', to: '22:00' } },
      globalStore: {
        slug: 'zara',
        name: 'Zara',
        socialLinks: [{ platform: 'INSTAGRAM', url: 'https://instagram.com/zara' }],
      },
    }],
  },
  'GET /public/stores/{slug}': {
    ...ENVELOPE,
    data: {
      id: 'store-uuid',
      name: 'Zara',
      detailTitle: 'Zara — Mall of İstanbul',
      description: 'Moda mağazası',
      floor: { id: 'floor-uuid', name: '2', label: '2. Kat' },
      phone: '+90 212 555 0000',
      whatsappPhone: '+90 532 555 0000',
      workingHours: {
        monday: { open: true, from: '10:00', to: '22:00' },
        sunday: { open: true, from: '11:00', to: '21:00' },
      },
      globalStore: {
        slug: 'zara',
        name: 'Zara',
        socialLinks: [
          { platform: 'INSTAGRAM', url: 'https://instagram.com/zara' },
          { platform: 'WEBSITE', url: 'https://www.zara.com' },
        ],
      },
      categories: [{ id: 'cat-uuid', name: 'Fashion', slug: 'fashion' }],
    },
  },
  'GET /public/events/{slug}': {
    ...ENVELOPE,
    data: { slug: 'summer-fest', title: 'Summer Festival', startsAt: '2026-07-01T18:00:00Z' },
  },
  'GET /public/search': {
    ...ENVELOPE,
    pagination: { page: 1, limit: 12, total: 3, totalPages: 1 },
    data: {
      results: [{ type: 'MALL_STORE', title: 'Zara', slug: 'zara', score: 0.95 }],
    },
  },
  'GET /public/pages/{slug}': {
    ...ENVELOPE,
    data: { slug: 'privacy-policy', title: 'Privacy Policy', blocks: [], renderMode: 'HTML' },
  },
};

const BASE_URL = 'https://api.example.com';
const TENANT = '550e8400-e29b-41d4-a716-446655440000';
const MALL = '660e8400-e29b-41d4-a716-446655440001';

/** Attach integration guides, code samples and response examples to developer portal OpenAPI. */
export function enrichDeveloperPortalOpenApi(document: OpenAPIObject): OpenAPIObject {
  const info = document.info as unknown as Record<string, unknown>;
  info['x-portal-developer'] = true;

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      const rk = routeKey(method, path);
      const guideKey = ENDPOINT_GUIDE_KEY_BY_ROUTE[rk];
      if (guideKey) {
        (operation as unknown as Record<string, unknown>)['x-dev-guide-key'] = guideKey;
      }

      const sampleCfg = ROUTE_SAMPLES[rk];
      if (sampleCfg) {
        const samplePath = path.replace(/\{slug\}/g, 'summer-sale').replace(/\{id\}/g, '550e8400-e29b-41d4-a716-446655440099');
        const samples = buildPublicCodeSamples(samplePath, {
          query: sampleCfg.query,
          sdkMethod: sampleCfg.sdkMethod,
          sdkArgs: sampleCfg.sdkArgs,
        });

      if (sampleCfg.reactHook && sampleCfg.reactFetch) {
        samples.push({
          lang: 'React',
          label: 'useEffect hook',
          source: buildReactHookSample(sampleCfg.reactHook, sampleCfg.reactFetch),
        });
      } else if (sampleCfg.sdkMethod) {
        const reactFetch = `const res = await fetch('${BASE_URL}${samplePath}${sampleCfg.query ? `?${new URLSearchParams(sampleCfg.query).toString()}` : ''}', {
          headers: { 'x-tenant-id': '${TENANT}', 'x-mall-id': '${MALL}', Accept: 'application/json' },
        });
        const json = await res.json();`;
        const hookName = `use${sampleCfg.sdkMethod.charAt(0).toUpperCase()}${sampleCfg.sdkMethod.slice(1)}`;
        samples.push({
          lang: 'React',
          label: 'useEffect hook',
          source: buildReactHookSample(hookName, reactFetch),
        });
      }

        (operation as unknown as Record<string, unknown>)['x-codeSamples'] = samples;
      }

      attachResponseExample(operation as unknown as Record<string, unknown>, rk);
    }
  }

  return document;
}

function attachResponseExample(operation: Record<string, unknown>, routeKeyStr: string): void {
  const example = RESPONSE_EXAMPLES[routeKeyStr];
  if (!example) return;

  const responses = operation.responses as
    | Record<string, { content?: Record<string, { example?: unknown }> }>
    | undefined;
  if (!responses?.['200']) return;

  responses['200'].content ??= {};
  responses['200'].content['application/json'] ??= {};
  responses['200'].content['application/json'].example = example;
}
