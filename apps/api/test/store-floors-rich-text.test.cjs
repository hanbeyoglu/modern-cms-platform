require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { MallStoresService } = require('../dist/mall-stores/mall-stores.service');
const { UpdateMallStoreDto } = require('../dist/mall-stores/dto/update-mall-store.dto');

test('store floor selection deduplicates, orders and rejects foreign, inactive or missing floors', async () => {
  const queries = [];
  const service = Object.create(MallStoresService.prototype);
  service.prisma = { mallFloor: { findMany: async ({ where }) => {
    queries.push(where);
    return [{ id: 'ground', tenantId: 't', mallId: 'm', active: true }, { id: 'first', tenantId: 't', mallId: 'm', active: true }].filter(row => where.id.in.includes(row.id) && row.tenantId === where.tenantId && row.mallId === where.mallId && row.active === where.active);
  } } };
  assert.deepEqual(await service.resolveFloorIds('t', 'm', ['first', 'ground', 'first']), ['ground', 'first']);
  assert.deepEqual(await service.resolveFloorIds('t', 'm', []), []);
  for (const [tenant, mall, ids] of [['t', 'm', ['foreign']], ['other', 'm', ['ground']], ['t', 'other', ['ground']]]) {
    await assert.rejects(service.resolveFloorIds(tenant, mall, ids), { status: 400 });
  }
  assert.equal(queries[0].active, true);
});

test('store updates replace or clear floors and preserve them when the property is omitted', async () => {
  const service = Object.create(MallStoresService.prototype); const updates = [];
  service.access = { assertMallAccess: async () => {} };
  service.audit = { logAction: async () => {} };
  service.searchIndexer = { syncMallStore: async () => {} };
  service.findOne = async () => ({});
  service.prisma = {
    mallFloor: { findMany: async () => [{ id: 'a' }, { id: 'b' }], findFirst: async () => ({ id: 'a', label: 'Zemin' }) },
    mallStore: { findFirst: async () => ({ id: 'store' }), update: async args => { updates.push(args.data); return { id: 'store' }; } },
  };
  const req = { tenantId: 't', mallId: 'm' }; const user = { id: 'u' };
  await service.update(req, user, 'store', { floorIds: ['a', 'b'] });
  assert.deepEqual(updates[0].floors, { set: [{ id: 'a' }, { id: 'b' }] });
  assert.deepEqual(updates[0].floorRecord, { connect: { id: 'a' } });
  await service.update(req, user, 'store', { floorIds: [] });
  assert.deepEqual(updates[1].floors, { set: [] });
  await service.update(req, user, 'store', { detailTitle: 'Name' });
  assert.equal(updates[2].floors, undefined);
});

test('rich description DTOs preserve formatting while removing scripts and unsafe links', async () => {
  const cases = [
    ['services/create-service.dto', 'CreateServiceDto'], ['services/update-service.dto', 'UpdateServiceDto'],
    ['cinemas/create-cinema.dto', 'CreateCinemaDto'], ['movies/create-movie.dto', 'CreateMovieDto'],
    ['global-stores/create-global-store.dto', 'CreateGlobalStoreDto'], ['popups/create-popup.dto', 'CreatePopupDto'],
    ['sliders/create-slider-item.dto', 'CreateSliderItemDto'], ['malls/create-location.dto', 'CreateLocationDto'],
  ];
  const html = '<p style="color:#ff0000"><strong>Başlık</strong></p><ul><li>Madde</li></ul><script>alert(1)</script><a href="javascript:alert(1)">link</a>';
  for (const [path, name] of cases) {
    const Class = require(`../dist/${path.replace('/', '/dto/')}`)[name];
    const dto = plainToInstance(Class, { description: html });
    assert.match(dto.description, /<strong>Başlık<\/strong>/);
    assert.match(dto.description, /<ul>/);
    assert.doesNotMatch(dto.description, /script|javascript:/);
  }
  const dto = plainToInstance(UpdateMallStoreDto, { floorIds: ['a', 42], localDescription: html });
  assert.doesNotMatch(dto.localDescription, /script/);
  assert.ok((await validate(dto)).some(error => error.property === 'floorIds'));
});

test('public stores expose ordered floor summaries while retaining the legacy primary floor', async () => {
  const { PublicContentService } = require('../dist/public/public-content.service');
  const service = Object.create(PublicContentService.prototype);
  let query;
  const floors = [{ id: 'ground', name: 'ground', label: 'Zemin' }, { id: 'first', name: 'first', label: '1. Kat' }];
  service.prisma = { mallStore: {
    count: async () => 1,
    findMany: async args => {
      query = args;
      return [{ id: 'store', mallId: 'm', floors, floorRecord: floors[0], floor: 'Zemin', floorId: 'ground', category: null, globalStore: { id: 'global', name: 'Store', logoMedia: null, socialLinksJson: null }, workingHoursJson: null, locationJson: null }];
    },
  } };
  const result = await service.getStores({ tenantId: 't', mallId: 'm' });
  assert.equal(query.where.tenantId, 't'); assert.equal(query.where.mallId, 'm');
  assert.equal(query.include.floors.where.active, true);
  assert.deepEqual(query.include.floors.orderBy, { sortOrder: 'asc' });
  assert.deepEqual(result.items[0].floors, floors);
  assert.deepEqual(result.items[0].floor, floors[0]);
  assert.equal(result.items[0].floorLabel, 'Zemin, 1. Kat');
});
