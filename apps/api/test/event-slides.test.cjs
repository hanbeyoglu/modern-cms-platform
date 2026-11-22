const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PublicContentService } = require('../dist/public/public-content.service');
const { PublicController } = require('../dist/public/public.controller');
const { SlidersService } = require('../dist/sliders/sliders.service');
const event = { id: 'event', mallId: 'mall', title: 'Event', translations: [], sameImageForAllLocales: true, sharedCoverImage: null };
const media = (id, extra = {}) => ({ id, tenantId: 'tenant', mallId: 'mall', deletedAt: null, status: 'ACTIVE', publicUrl: `https://cdn.example.com/${id}.jpg`, altText: 'Alt', caption: 'Caption', ...extra });
const item = (id, sortOrder, image) => ({ id, sortOrder, status: 'PUBLISHED', sameImageForAllLocales: true, sharedImage: image, sharedMobileImage: null, translations: [] });
function fixture(items) {
  const prisma = { event: { findFirst: async () => event }, slider: { findMany: async ({ where, include, take }) => {
    assert.equal(where.tenantId, 'tenant'); assert.equal(where.mallId, 'mall');
    assert.equal(where.linkedEntityId, 'event'); assert.equal(where.linkedEntityType, 'EVENT');
    assert.equal(where.status, 'PUBLISHED'); assert.equal(where.deletedAt, null);
    assert.equal(where.AND.length, 2); assert.equal(take, undefined);
    assert.deepEqual(include.items.where, { deletedAt: null, status: 'PUBLISHED' });
    return [{ id: 'group', title: 'Gallery', items }];
  } } };
  return new PublicContentService(prisma, {});
}
const opts = { tenantId: 'tenant', mallId: 'mall', slug: 'event' };
test('event slides flatten real group items, sort and retain image metadata', async () => {
  const result = await fixture([item('b', 2, media('b')), item('a', 0, media('a'))]).getEventBySlug(opts);
  assert.deepEqual(result.sliders, ['a', 'b'].map((id, i) => ({ id, sortOrder: i * 2, image: { id, url: `https://cdn.example.com/${id}.jpg`, alt: 'Alt', caption: 'Caption' } })));
  assert.equal(result.image, null);
});
test('empty gallery stays empty; cover is never substituted', async () => {
  assert.deepEqual((await fixture([]).getEventBySlug(opts)).sliders, []);
});
test('foreign, deleted, inactive and local-only media never leak into event slides', async () => {
  const images = [media('foreign', { tenantId: 'other' }), media('otherMall', { mallId: 'other' }), media('deleted', { deletedAt: new Date() }), media('inactive', { status: 'ARCHIVED' }), media('local', { publicUrl: 'http://localhost:4000/uploads/a.jpg' }), media('valid')];
  const result = await fixture(images.map((m, i) => item(m.id, i, m))).getEventBySlug(opts);
  assert.deepEqual(result.sliders.map(s => s.id), ['valid']);
});
test('slider reorder invalidates cached event detail; next request returns new order', async () => {
  const items = [item('a', 0, media('a')), item('b', 1, media('b'))];
  const content = fixture(items);
  const entries = new Map();
  const cache = { get: async key => entries.get(key), set: async (key, value) => entries.set(key, value), invalidateTenant: async tenant => { assert.equal(tenant, 'tenant'); entries.clear(); } };
  const ctx = { resolve: async () => ({ tenantId: 'tenant', mallId: 'mall', locale: null }) };
  const controller = new PublicController(ctx, content, cache);
  const read = async () => (await controller.getEventBySlug('tenant', 'mall', 'event')).data.sliders.map(s => s.id);
  assert.deepEqual(await read(), ['a', 'b']);
  const prisma = { slider: { findFirst: async () => ({ id: 'group', tenantId: 'tenant' }) }, sliderItem: { findMany: async () => items, update: async ({ where, data }) => Object.assign(items.find(i => i.id === where.id), data) }, $transaction: async jobs => Promise.all(jobs) };
  const sliders = new SlidersService(prisma, { logAction: async () => {} }, { syncSlider: async () => {} }, cache);
  await sliders.reorderItems('group', { items: [{ id: 'a', sortOrder: 2 }, { id: 'b', sortOrder: 0 }] }, { id: 'user' }, 'tenant');
  assert.deepEqual(await read(), ['b', 'a']);
});
test('localized slide resolves through media URL service to CDN, preserving caption', async () => {
  const slide = item('localized', 0, null);
  slide.sameImageForAllLocales = false;
  slide.translations = [{ localeId: 'tr', title: null, description: null, buttonText: null, image: media('tr', { publicUrl: 'http://localhost:4000/uploads/tr.jpg', storageKey: 'events/tr.jpg' }), mobileImage: null }];
  const content = fixture([slide]);
  content.resolver = { getTranslationsForEntities: async () => new Map() };
  // Same injected URL resolver used by the application, with no external network calls.
  new PublicContentService({}, {}, { resolve: (_url, key) => `https://cdn.example.com/${key}` });
  try {
    const result = await content.getEventBySlug({ ...opts, localeId: 'tr' });
    assert.equal(result.sliders[0].image.url, 'https://cdn.example.com/events/tr.jpg');
    assert.equal(result.sliders[0].image.caption, 'Caption');
  } finally {
    new PublicContentService({}, {}, { resolve: url => url });
  }
});
