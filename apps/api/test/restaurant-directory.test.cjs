require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { PublicContentService } = require('../dist/public/public-content.service');
const { PublicController } = require('../dist/public/public.controller');
const { MallStoresService } = require('../dist/mall-stores/mall-stores.service');
const { AssignMallStoreDto } = require('../dist/mall-stores/dto/assign-mall-store.dto');

test('restaurant kind is validated without accepting arbitrary values', async () => {
  for (const [kind, valid] of [['RESTAURANT', true], ['STORE', true], ['OTHER', false]]) {
    const errors = await validate(plainToInstance(AssignMallStoreDto, { globalStoreId: 'brand', kind }));
    assert.equal(errors.some(e => e.property === 'kind'), !valid);
  }
});
test('admin restaurant listing stays in authorized tenant/mall and only queries restaurants', async () => {
  const service = Object.create(MallStoresService.prototype); let where;
  service.access = { assertMallAccess: async (_u, tenant, mall) => { assert.equal(tenant, 't'); assert.equal(mall, 'm'); } };
  service.prisma = { mallStore: { findMany: async args => { where = args.where; return []; }, count: async () => 0 } };
  const response = await service.list({ tenantId: 't', mallId: 'm' }, { id: 'u' }, { kind: 'RESTAURANT', page: 1, limit: 20 });
  assert.equal(where.kind, 'RESTAURANT'); assert.equal(where.tenantId, 't'); assert.equal(where.mallId, 'm');
  assert.equal(response.total, 0);
});
test('public restaurant filtering preserves publication rules, scope and legacy unfiltered directory', async () => {
  const service = Object.create(PublicContentService.prototype); const queries = [];
  service.prisma = { mallStore: { count: async () => 0, findMany: async args => { queries.push(args.where); return []; } } };
  await service.getStores({ tenantId: 't', mallId: 'm', kind: 'RESTAURANT' });
  assert.equal(queries[0].kind, 'RESTAURANT'); assert.equal(queries[0].status, 'ACTIVE'); assert.equal(queries[0].deletedAt, null);
  assert.equal(queries[0].globalStore.is.status, 'ACTIVE'); assert.equal(queries[0].tenantId, 't'); assert.equal(queries[0].mallId, 'm');
  await service.getStores({ tenantId: 't', mallId: 'm' }); assert.equal(queries[1].kind, undefined);
});
test('public cache separates restaurant and store requests; invalid kind is rejected', async () => {
  const controller = Object.create(PublicController.prototype); const keys = []; const options = [];
  controller.ctx = { resolve: async () => ({ tenantId: 't', mallId: 'm', tenant: { id: 't', slug: 't', name: 'Tenant' }, locale: { id: 'tr', code: 'tr' } }) };
  controller.cache = { get: async key => { keys.push(key); return null; }, set: async () => {} };
  controller.content = { getStores: async opts => { options.push(opts); return { items: [], total: 0 }; } };
  for (const kind of ['STORE', 'RESTAURANT']) {
    const result = await controller.getStores('t', 'm', undefined, undefined, undefined, '1', '100', 'tr', kind);
    assert.equal(result.success, true); assert.deepEqual(result.data, []);
  }
  assert.notEqual(keys[0], keys[1]); assert.equal(options[1].kind, 'RESTAURANT');
  await assert.rejects(controller.getStores('t', 'm', undefined, undefined, undefined, '1', '100', 'tr', 'INVALID'), { status: 400 });
});
