const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventsService } = require('../dist/events/events.service');
const { sanitizeLocalizedRichText } = require('../dist/common/utils/rich-text');

const dirty = '<h2>Etkinlik</h2><p><span style="color:#ff0000" onclick="bad()">Renkli</span></p><ul><li>Program</li></ul><script>bad()</script>';
const safe = '<h2>Etkinlik</h2><p><span style="color:#ff0000">Renkli</span></p><ul><li>Program</li></ul>';

test('event create/update and its translations keep formatting and strip unsafe HTML', async () => {
  let saved;
  const translated = [];
  const prisma = {
    event: {
      findFirst: async ({ where }) => where.slug ? null : saved,
      create: async ({ data }) => { saved = { id: 'event', deletedAt: null, ...data }; return saved; },
      update: async ({ data }) => { saved = { ...saved, ...data }; return saved; },
    },
    eventTranslation: { upsert: async ({ create, update }) => { translated.push({ create, update }); } },
  };
  const service = new EventsService(prisma, { logAction: async () => {} }, { syncEvent: async () => {} }, {}, { invalidateTenant: async () => {} });
  const event = await service.create({ title: 'Etkinlik', isFree: false, description: dirty, translations: [{ localeId: 'tr', description: dirty }] }, { id: 'user' }, 'tenant', 'mall');
  assert.equal(event.description, safe);
  assert.equal(event.isFree, false);
  assert.equal(event.title, 'Etkinlik');
  assert.equal(translated[0].create.description, safe);
  assert.equal(translated[0].update.description, safe);
  await service.update('event', { description: '<p><strong>Yeni</strong></p>' }, { id: 'user' }, 'tenant', 'mall');
  assert.equal(saved.description, '<p><strong>Yeni</strong></p>');
  assert.equal(saved.isFree, false);
  await service.update('event', { isFree: true }, { id: 'user' }, 'tenant', 'mall');
  assert.equal(saved.isFree, true);
  await service.update('event', { description: '' }, { id: 'user' }, 'tenant', 'mall');
  assert.equal(saved.description, null);
});

test('generic translations sanitize event descriptions and campaign fields only', () => {
  assert.equal(sanitizeLocalizedRichText('EVENT', 'description', dirty), safe);
  assert.equal(sanitizeLocalizedRichText('CAMPAIGN', 'description', dirty), safe);
  assert.equal(sanitizeLocalizedRichText('CAMPAIGN', 'terms', dirty), safe);
  assert.equal(sanitizeLocalizedRichText('EVENT', 'title', 'A & B'), 'A & B');
  assert.equal(sanitizeLocalizedRichText('EVENT', 'shortDescription', 'Kısa açıklama'), 'Kısa açıklama');
  assert.equal(sanitizeLocalizedRichText('EVENT', 'description', 'Satır 1\nSatır 2'), 'Satır 1\nSatır 2');
});


test('event admission DTOs accept booleans and reject strings or null', async () => {
  const { validate } = require('class-validator');
  const { CreateEventDto } = require('../dist/events/dto/create-event.dto');
  const { UpdateEventDto } = require('../dist/events/dto/update-event.dto');
  for (const Dto of [CreateEventDto, UpdateEventDto]) {
    for (const value of [true, false, undefined]) {
      const errors = await validate(Object.assign(new Dto(), { title: 'Event', isFree: value }));
      assert.equal(errors.some(e => e.property === 'isFree'), false);
    }
    for (const value of ['false', 'true', null, 0]) {
      const errors = await validate(Object.assign(new Dto(), { title: 'Event', isFree: value }));
      assert.equal(errors.some(e => e.property === 'isFree'), true);
    }
  }
});

test('public event list and detail expose free and paid admission', async () => {
  const { PublicContentService } = require('../dist/public/public-content.service');
  for (const isFree of [true, false]) {
    const row = { id: 'event', title: 'Event', isFree, description: 'Description', shortDescription: null,
      sameImageForAllLocales: true, sharedCoverImage: null, translations: [],
      publishStartAt: null, publishEndAt: null, eventStartAt: null, eventEndAt: null, publishedAt: null };
    const content = new PublicContentService({ slider: { findMany: async () => [] }, event: { findMany: async () => [row], count: async () => 1, findFirst: async () => row } }, {});
    const list = await content.getEvents({ tenantId: 'tenant', mallId: 'mall' });
    assert.equal(list.items[0].isFree, isFree);
    assert.equal((await content.getEventBySlug({ tenantId: 'tenant', mallId: 'mall', slug: 'event' })).isFree, isFree);
  }
});

test('event detail includes its scoped published slider groups and image slides', async () => {
  const { PublicContentService } = require('../dist/public/public-content.service');
  const event = { id: 'event-1', title: 'Event', isFree: false, sameImageForAllLocales: true, sharedCoverImage: null, translations: [], publishStartAt: null, publishEndAt: null, eventStartAt: null, eventEndAt: null, publishedAt: null };
  const image = { id: 'image', publicUrl: 'https://cdn.example.com/event.jpg', mimeType: 'image/jpeg', width: 1920, height: 800 };
  const slides = ['DRAFT', 'PUBLISHED'].map((status, i) => ({ id: `slide-${i}`, status, title: 'Slide title', sameImageForAllLocales: true, sharedImage: image, sharedMobileImage: null, translations: [], sortOrder: i }));
  const content = new PublicContentService({
    event: { findFirst: async () => event },
    slider: { findMany: async ({ where, include, orderBy }) => {
      assert.equal(where.tenantId, 'tenant');
      assert.equal(where.mallId, 'mall');
      assert.equal(where.placementType, 'EVENT');
      assert.equal(where.linkedEntityId, event.id);
      assert.equal(where.status, 'PUBLISHED');
      assert.equal(where.deletedAt, null);
      assert.equal(where.AND.length, 2); // Publication window remains enforced.
      assert.deepEqual(orderBy[0], { sortOrder: 'asc' });
      assert.deepEqual(include.items.orderBy[0], { sortOrder: 'asc' });
      return [{ id: 'event-slider', title: 'Event gallery', placementType: 'EVENT', linkedEntityId: event.id, startAt: null, endAt: null,
        items: slides.filter(s => s.status === include.items.where.status) }];
    } },
  }, {});
  const result = await content.getEventBySlug({ tenantId: 'tenant', mallId: 'mall', slug: 'event' });
  assert.equal(result.isFree, false);
  assert.equal(result.sliders.length, 1);
  assert.equal(result.sliders[0].items.length, 1);
  assert.equal(result.sliders[0].items[0].title, 'Slide title');
  assert.equal(result.sliders[0].items[0].image.url, image.publicUrl);
});

test('a missing event does not fetch or expose slider groups', async () => {
  const { PublicContentService } = require('../dist/public/public-content.service');
  const content = new PublicContentService({ event: { findFirst: async () => null }, slider: { findMany: async () => { throw new Error('Should not fetch sliders'); } } }, {});
  assert.equal(await content.getEventBySlug({ tenantId: 'tenant', mallId: 'mall', slug: 'missing' }), null);
});
