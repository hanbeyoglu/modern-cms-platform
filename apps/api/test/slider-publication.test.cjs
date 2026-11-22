const assert = require('node:assert/strict');
const { test } = require('node:test');
const { SlidersService } = require('../dist/sliders/sliders.service');
const { PublicContentService } = require('../dist/public/public-content.service');

function fixture(items, cacheFails = false) {
  const invalidated = [];
  const writes = [];
  const group = { id: 'slider', tenantId: 'tenant', mallId: 'mall', status: 'DRAFT', startAt: null };
  const prisma = {
    slider: {
      findFirst: async () => group,
      update: async ({ data }) => { writes.push(data); return { ...group, ...data }; },
    },
    sliderItem: { findMany: async ({ where }) => items.filter(item => !item.deletedAt && item.status === where.status) },
  };
  const service = new SlidersService(prisma, { logAction: async () => {} }, { syncSlider: async () => {} }, {
    invalidateTenant: async (tenant) => { invalidated.push(tenant); if (cacheFails) throw new Error('offline'); },
  });
  return { service, invalidated, writes };
}

test('a group with only draft image slides cannot be published', async () => {
  const { service, writes } = fixture([{ status: 'DRAFT', sharedImageId: 'image', translations: [] }]);
  await assert.rejects(service.publish('slider', { id: 'user' }, 'tenant'), { status: 422 });
  assert.equal(writes.length, 0);
});
test('a published image slide allows group publication and invalidates public caches', async () => {
  const { service, invalidated } = fixture([{ status: 'PUBLISHED', sharedImageId: 'image', translations: [] }]);
  const group = await service.publish('slider', { id: 'user' }, 'tenant');
  assert.equal(group.status, 'PUBLISHED');
  assert.deepEqual(invalidated, ['tenant']);
});
test('cache failure does not turn a saved publication into an error', async () => {
  const { service } = fixture([{ status: 'PUBLISHED', sharedImageId: 'image', translations: [] }], true);
  assert.equal((await service.publish('slider', { id: 'user' }, 'tenant')).status, 'PUBLISHED');
});
test('public slider response contains published slides and their images, hiding drafts', async () => {
  const image = { id: 'image', publicUrl: 'https://cdn.example.com/hero.jpg', mimeType: 'image/jpeg', altText: 'Hero', width: 1920, height: 800 };
  const items = ['DRAFT', 'PUBLISHED'].map((status, i) => ({ id: `item-${i}`, status, title: 'Hero', description: null, buttonText: null, linkUrl: null, sortOrder: i, sameImageForAllLocales: true, sharedImage: image, sharedMobileImage: null, translations: [] }));
  const content = new PublicContentService({ slider: { findMany: async ({ where, include }) => {
    assert.equal(where.tenantId, 'tenant');
    assert.equal(where.mallId, 'mall');
    assert.equal(where.status, 'PUBLISHED');
    assert.equal(include.items.where.deletedAt, null);
    return [{ id: 'slider', title: 'Ana sayfa', placementType: 'HOME', linkedEntityType: null, linkedEntityId: null, sortOrder: 0, startAt: null, endAt: null, items: items.filter(item => item.status === include.items.where.status) }];
  } } }, {});
  const [slider] = await content.getSliders({ tenantId: 'tenant', mallId: 'mall', placement: 'HOME' });
  assert.equal(slider.items.length, 1);
  assert.equal(slider.items[0].id, 'item-1');
  assert.equal(slider.items[0].desktopMedia.url, image.publicUrl);
  assert.equal(slider.desktopMedia.url, image.publicUrl);
});

test('group and slide reorder persist and public reads follow the admin order', async () => {
  const groups = [
    { id: 'a', sortOrder: 0, createdAt: new Date(0), items: [{ id: 'a1', sortOrder: 0, createdAt: new Date(0) }, { id: 'a2', sortOrder: 0, createdAt: new Date(1) }] },
    { id: 'b', sortOrder: 0, createdAt: new Date(1), items: [] },
  ];
  const invalidated = [];
  const sortRows = (rows, orderBy) => [...rows].sort((a, b) => {
    for (const entry of orderBy) {
      const [key, dir] = Object.entries(entry)[0];
      const cmp = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
      if (cmp) return dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
  const prisma = {
    $transaction: async (jobs) => Promise.all(jobs),
    slider: {
      count: async () => groups.length,
      findFirst: async () => ({ id: 'a', tenantId: 'tenant' }),
      findMany: async ({ where, include, orderBy }) => {
        if (!include) return groups.filter(g => where.id.in.includes(g.id)).map(g => ({ id: g.id }));
        return sortRows(groups, orderBy).map(g => ({ ...g, title: g.id, placementType: 'HOME', startAt: null, endAt: null, items: sortRows(g.items, include.items.orderBy).map(i => ({ ...i, status: 'PUBLISHED', sameImageForAllLocales: true, sharedImage: null, sharedMobileImage: null, translations: [] })) }));
      },
      update: async ({ where, data }) => Object.assign(groups.find(g => g.id === where.id), data),
    },
    sliderItem: {
      findMany: async ({ where }) => groups.find(g => g.id === where.sliderId).items.filter(i => where.id.in.includes(i.id)),
      update: async ({ where, data }) => Object.assign(groups.flatMap(g => g.items).find(i => i.id === where.id), data),
    },
  };
  const service = new SlidersService(prisma, { logAction: async () => {} }, { syncSlider: async () => {} }, { invalidateTenant: async t => invalidated.push(t) });
  const content = new PublicContentService(prisma, {});
  const compare = async () => {
    const admin = (await service.list('tenant', 'mall', {})).sliders;
    const web = await content.getSliders({ tenantId: 'tenant', mallId: 'mall' });
    assert.deepEqual(web.map(g => g.id), admin.map(g => g.id));
    assert.deepEqual(web.find(g => g.id === 'a').items.map(i => i.id), admin.find(g => g.id === 'a').items.map(i => i.id));
    return web;
  };
  await compare(); // Equal sortOrder values also use the same stable fallback.
  await service.reorder({ items: [{ id: 'a', sortOrder: 0 }, { id: 'b', sortOrder: 1 }] }, { id: 'user' }, 'tenant', 'mall');
  await service.reorderItems('a', { items: [{ id: 'a1', sortOrder: 1 }, { id: 'a2', sortOrder: 0 }] }, { id: 'user' }, 'tenant');
  const web = await compare();
  assert.deepEqual(web.map(g => g.id), ['a', 'b']);
  assert.deepEqual(web[0].items.map(i => i.id), ['a2', 'a1']);
  assert.ok(invalidated.length > 0);
});

test('both reorder routes explicitly return 204 with no JSON body', () => {
  const { SlidersController } = require('../dist/sliders/sliders.controller');
  const { HTTP_CODE_METADATA } = require('@nestjs/common/constants');
  for (const method of ['reorder', 'reorderItems']) {
    assert.equal(Reflect.getMetadata(HTTP_CODE_METADATA, SlidersController.prototype[method]), 204);
  }
});
