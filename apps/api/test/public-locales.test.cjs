const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LocalesService } = require('../dist/locales/locales.service');
const { MallLocalesService } = require('../dist/mall-locales/mall-locales.service');
const { TranslationResolverService } = require('../dist/translation-resolver/translation-resolver.service');
const { PublicContextService } = require('../dist/public/public-context.service');
const { PublicController } = require('../dist/public/public.controller');
const { localeDirection } = require('../dist/locales/supported-languages');
function fixture() {
  const locales = [
    { id: 'tr', tenantId: 'tenant', code: 'tr', nativeName: 'Türkçe', rtl: false, isActive: true, isDefault: true, sortOrder: 0 },
    { id: 'ar', tenantId: 'tenant', code: 'ar', nativeName: 'العربية', rtl: false, isActive: true, isDefault: false, sortOrder: 1 },
    { id: 'en', tenantId: 'tenant', code: 'en', nativeName: 'English', rtl: false, isActive: false, isDefault: false, sortOrder: 2 },
    { id: 'foreign', tenantId: 'other', code: 'fr', rtl: false, isActive: true, isDefault: true },
  ];
  const overrides = [];
  const match = (row, where) => Object.entries(where).every(([key, value]) => value && typeof value === 'object' ? (value.in ? value.in.includes(row[key]) : value.not ? row[key] !== value.not : true) : row[key] === value);
  const entries = new Map(); const invalidated = [];
  const cache = { get: async key => entries.get(key), set: async (key, value) => entries.set(key, value), invalidateTenant: async id => { invalidated.push(id); entries.clear(); } };
  const audit = { logAction: async () => {} };
  const prisma = {
    tenant: { findFirst: async ({where}) => where.id === 'tenant' ? { id: 'tenant', status: 'ACTIVE' } : null },
    tenantSetting: { findUnique: async () => null },
    mall: { findFirst: async ({where}) => where.tenantId && where.tenantId !== 'tenant' ? null : where.isPublic ? null : { id: where.id, tenantId: 'tenant', status: 'LIVE' } },
    locale: {
      findMany: async ({where}) => locales.filter(l => match(l, where)).sort((a,b) => a.sortOrder - b.sortOrder),
      findFirst: async ({where}) => locales.find(l => match(l, where)) ?? null,
      count: async ({where}) => locales.filter(l => match(l, where)).length,
      update: async ({where, data}) => Object.assign(locales.find(l => l.id === where.id), data),
      updateMany: async ({where, data}) => { locales.filter(l => match(l, where)).forEach(l => Object.assign(l, data)); },
      findUnique: async () => null,
      aggregate: async () => ({ _max: { sortOrder: 2 } }),
      create: async ({data}) => { const row = { id: data.code, ...data }; locales.push(row); return row; },
    },
    mallLocale: {
      findMany: async ({where}) => overrides.filter(l => match(l, where)),
      upsert: async ({where, create, update}) => { const row = overrides.find(l => l.mallId === where.mallId_localeId.mallId && l.localeId === where.mallId_localeId.localeId); if (row) return Object.assign(row, update); overrides.push(create); return create; },
    },
    $transaction: async jobs => Promise.all(jobs),
  };
  const mallLocales = new MallLocalesService(prisma, audit, cache);
  const resolver = new TranslationResolverService(prisma, mallLocales);
  const ctx = new PublicContextService(prisma, resolver);
  const controller = new PublicController(ctx, {}, cache, {}, {}, prisma, mallLocales, {});
  const service = new LocalesService(prisma, audit, cache);
  return { locales, overrides, cache, invalidated, service, mallLocales, resolver, controller };
}
test('active system languages inherit into website; Arabic direction is repaired without DB writes', async () => {
  const f = fixture();
  const response = await f.controller.getSiteConfig('tenant', 'mall', 'AR');
  assert.deepEqual(response.data.languages, [{ code: 'tr', default: true, rtl: false }, { code: 'ar', default: false, rtl: true }]);
  assert.equal(response.data.rtl, true); assert.equal(response.data.activeLocale, 'ar');
  assert.equal(response.data.supportedLocales[1].rtl, true);
  assert.equal(f.locales.find(l => l.id === 'ar').rtl, false); // GET is read-only
  assert.equal(f.invalidated.length, 0);
});
test('location deactivation persists explicit false, affects only that mall and clears cached configuration', async () => {
  const f = fixture();
  await f.controller.getSiteConfig('tenant', 'mall', 'tr');
  await f.mallLocales.updateForLocation('tenant', 'mall', { locales: [{ localeId: 'ar', isActive: false }] }, {id:'user'});
  assert.equal(f.overrides[0].isActive, false);
  assert.deepEqual((await f.controller.getSiteConfig('tenant', 'mall', 'tr')).data.languages.map(l => l.code), ['tr']);
  assert.deepEqual((await f.mallLocales.getActiveLocalesForMall('tenant', 'other-mall')).map(l => l.code), ['tr', 'ar']);
  assert.equal((await f.resolver.resolveLocale('tenant', 'ar', 'mall')).code, 'tr');
  await f.mallLocales.updateForLocation('tenant', 'mall', { locales: [{ localeId: 'ar', isActive: true }] }, {id:'user'});
  assert.equal((await f.resolver.resolveLocale('tenant', 'ar', 'mall')).rtl, true);
  await assert.rejects(f.mallLocales.getActiveLocalesForMall('other', 'mall'), {status:404});
});
test('activation, deactivation, default and reorder invalidate public responses; inactive translations are not selected', async () => {
  const f = fixture();
  await f.controller.getSiteConfig('tenant', 'mall', 'tr');
  await f.service.update('en', {isActive:true}, {id:'user'}, 'tenant');
  assert.deepEqual((await f.controller.getSiteConfig('tenant', 'mall', 'tr')).data.languages.map(l => l.code), ['tr','ar','en']);
  await f.service.setDefault('ar', {id:'user'}, 'tenant');
  assert.equal((await f.controller.getSiteConfig('tenant', 'mall')).data.rtl, true);
  await f.service.deactivate('en', {id:'user'}, 'tenant');
  assert.equal((await f.resolver.resolveLocale('tenant', 'en', 'mall')).code, 'ar');
  await f.service.reorder(['ar','tr','en'], {id:'user'}, 'tenant');
  assert.deepEqual((await f.controller.getSiteConfig('tenant', 'mall')).data.languages.map(l => l.code), ['ar','tr']);
  assert.deepEqual(f.invalidated, ['tenant','tenant','tenant','tenant']);
});
test('locale create/update canonicalizes known direction and preserves custom direction', async () => {
  const f = fixture();
  assert.equal((await f.service.update('ar', {rtl:false}, {id:'user'}, 'tenant')).rtl, true);
  const created = await f.service.create({code:' AR_SA ', name:'Arabic', nativeName:'العربية', rtl:false}, {id:'user'}, 'tenant');
  assert.equal(created.code, 'ar-sa'); assert.equal(created.rtl, true);
  assert.equal((await f.resolver.resolveLocale('tenant','AR_sa','mall')).code, 'ar-sa');
  await assert.rejects(f.service.create({code:'es',name:'Spanish',nativeName:'Español',isDefault:true,isActive:false}, {id:'user'}, 'tenant'), {status:400});
  assert.equal(localeDirection('ar-Latn'), false);
  assert.equal(localeDirection('az-Arab'), true);
  assert.equal(localeDirection('unknown'), undefined);
});
test('default cannot be disabled at the location and inactive system languages cannot be enabled', async () => {
  const f = fixture();
  for (const value of [{localeId:'tr',isActive:false},{localeId:'en',isActive:true},{localeId:'foreign',isActive:true}]) {
    await assert.rejects(f.mallLocales.updateForLocation('tenant','mall',{locales:[value]},{id:'user'}),{status:400});
  }
});
