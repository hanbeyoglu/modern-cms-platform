const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validate } = require('class-validator');
const { ServicesService } = require('../dist/services/services.service');
const { CreateServiceDto } = require('../dist/services/dto/create-service.dto');
const { UpdateServiceDto } = require('../dist/services/dto/update-service.dto');
const { PublicContentService } = require('../dist/public/public-content.service');

const user = { id: 'user' };
function fixture() {
  const calls = [];
  const floors = [{ id: 'f1', tenantId: 't', mallId: 'm', label: 'Zemin' }, { id: 'f2', tenantId: 't', mallId: 'm', label: 'Birinci' }, { id: 'foreign', tenantId: 'other', mallId: 'other', label: 'Other' }];
  const prisma = {
    mallFloor: { findMany: async ({ where }) => floors.filter(f => where.id.in.includes(f.id) && f.tenantId === where.tenantId && f.mallId === where.mallId) },
    service: {
      findFirst: async () => ({ id: 'svc', tenantId: 't', mallId: 'm' }),
      create: async ({ data }) => { calls.push(data); return { id: 'svc', ...data }; },
      update: async ({ data }) => { calls.push(data); return { id: 'svc', mallId: 'm', ...data }; },
    },
  };
  return { calls, service: new ServicesService(prisma, { logAction: async () => {} }, { syncService: async () => {} }, { invalidateMall: async () => {} }) };
}
test('create connects multiple scoped floors and derives legacy display', async () => {
  const { service, calls } = fixture();
  await service.create({ name: 'WC', floorIds: ['f1', 'f2'] }, user, 't', 'm');
  assert.deepEqual(calls[0].floors.connect, [{ id: 'f1' }, { id: 'f2' }]);
  assert.equal(calls[0].floor, 'Zemin, Birinci');
});
test('unknown and cross-tenant/mall floors cannot be assigned on create/update', async () => {
  for (const floorId of ['foreign', 'missing']) {
    const { service, calls } = fixture();
    await assert.rejects(service.create({ name: 'WC', floorIds: [floorId] }, user, 't', 'm'), { status: 400 });
    await assert.rejects(service.update('svc', { floorIds: [floorId] }, user, 't'), { status: 400 });
    assert.equal(calls.length, 0);
  }
});
test('updates replace/clear selections; omitted floorIds preserves assignments', async () => {
  const { service, calls } = fixture();
  await service.update('svc', { floorIds: ['f2'] }, user, 't');
  await service.update('svc', { floorIds: [] }, user, 't');
  await service.update('svc', { name: 'WC+' }, user, 't');
  assert.deepEqual(calls[0].floors.set, [{ id: 'f2' }]);
  assert.deepEqual(calls[1].floors.set, []);
  assert.equal(calls[1].floor, null);
  assert.equal('floors' in calls[2], false);
  assert.equal('floor' in calls[2], false);
});
test('DTOs validate multiple floor IDs and reject duplicates and free text', async () => {
  for (const Dto of [CreateServiceDto, UpdateServiceDto]) {
    assert.equal((await validate(Object.assign(new Dto(), { name: 'WC', floorIds: ['f1', 'f2'] }))).length, 0);
    assert.ok((await validate(Object.assign(new Dto(), { name: 'WC', floorIds: ['f1', 'f1'] }))).length);
    assert.ok((await validate(Object.assign(new Dto(), { name: 'WC', floor: 'arbitrary' }), { whitelist: true, forbidNonWhitelisted: true })).length);
  }
});
test('public list and detail expose safe floor fields and current labels', async () => {
  const row = { id: 'svc', floor: 'old label', floors: [{ id: 'f1', name: 'ground', label: 'Zemin' }, { id: 'f2', name: 'first', label: 'Birinci' }], iconMedia: null, coverMedia: null };
  const content = new PublicContentService({ service: { findMany: async () => [row], count: async () => 1, findFirst: async () => row } }, {});
  const result = await content.getLocationServices({ tenantId: 't', mallId: 'm' });
  assert.deepEqual(result.items[0].floors, row.floors);
  assert.equal(result.items[0].floor, 'Zemin, Birinci');
  assert.deepEqual((await content.getLocationServiceById({ tenantId: 't', mallId: 'm', id: 'svc' })).floors, row.floors);
});
