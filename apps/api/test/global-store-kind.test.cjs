const assert = require('node:assert/strict');
const { test } = require('node:test');
const { MallStoresService } = require('../dist/mall-stores/mall-stores.service');
const { GlobalStoresService } = require('../dist/global-stores/global-stores.service');

test('assignment rejects a type that disagrees with the global brand before writing', async () => {
  const s = Object.create(MallStoresService.prototype);
  s.access = { assertMallAccess: async () => {} };
  s.prisma = { globalStore: { findFirst: async () => ({ id: 'g', kind: 'RESTAURANT' }) } };
  await assert.rejects(s.assign({ tenantId: 't', mallId: 'm' }, { id: 'u' }, { globalStoreId: 'g', kind: 'STORE' }), { status: 400 });
});
test('local updates cannot change type; restaurant updates discard category selection', async () => {
  const s = Object.create(MallStoresService.prototype); const writes = [];
  s.access = { assertMallAccess: async () => {} }; s.audit = { logAction: async () => {} };
  s.searchIndexer = { syncMallStore: async () => {} }; s.findOne = async () => ({});
  s.prisma = { globalStore: { findFirst: async () => ({ kind: 'RESTAURANT' }) }, mallStore: {
    findFirst: async () => ({ id: 's', globalStoreId: 'g' }), update: async ({ data }) => { writes.push(data); return { id: 's' }; },
  } };
  const req = { tenantId: 't', mallId: 'm' };
  await assert.rejects(s.update(req, { id: 'u' }, 's', { kind: 'STORE' }), { status: 400 });
  await s.update(req, { id: 'u' }, 's', { categoryId: 'foreign-category' });
  assert.equal(writes[0].kind, 'RESTAURANT'); assert.deepEqual(writes[0].category, { disconnect: true });
});
test('global directory filters kind and type changes synchronize assigned locations in one transaction', async () => {
  const s = Object.create(GlobalStoresService.prototype); const writes = [];
  s.audit = { logAction: async () => {} }; s.searchIndexer = { syncGlobalStore: async () => {} };
  const existing = { id: 'g', kind: 'STORE', name: 'Brand', slug: 'brand' };
  s.prisma = {
    globalStore: { findFirst: async () => existing, findMany: async args => { writes.push(args.where); return []; }, count: async () => 0 },
    $transaction: async callback => callback({ globalStore: { update: async ({ data }) => ({ ...existing, ...data }) }, mallStore: { updateMany: async args => writes.push(args) } }),
  };
  await s.list({ kind: 'RESTAURANT', page: 1, limit: 20 });
  assert.equal(writes[0].kind, 'RESTAURANT');
  await s.update('g', { kind: 'RESTAURANT' }, { id: 'admin' });
  assert.deepEqual(writes[1], { where: { globalStoreId: 'g' }, data: { kind: 'RESTAURANT', categoryId: null } });
});
