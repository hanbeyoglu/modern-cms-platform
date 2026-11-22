const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ServicesService } = require('../dist/services/services.service');

function makeService({ invalidateError } = {}) {
  const invalidated = [];
  const cache = {
    invalidateMall: async (tenantId, mallId) => {
      invalidated.push({ tenantId, mallId });
      if (invalidateError) throw invalidateError;
    },
  };
  const audit = { logAction: async () => undefined };
  const searchIndexer = { syncService: async () => undefined };
  const prisma = {
    service: {
      create: async ({ data }) => ({
        id: 'svc-1',
        ...data,
        iconMedia: null,
        coverMedia: null,
      }),
      findFirst: async () => ({
        id: 'svc-1',
        tenantId: 'tenant',
        mallId: 'mall',
        name: 'Vale',
        status: 'ACTIVE',
        deletedAt: null,
      }),
      update: async ({ data }) => ({
        id: 'svc-1',
        tenantId: 'tenant',
        mallId: 'mall',
        name: data.name ?? 'Vale',
        status: data.status ?? 'ACTIVE',
        workingHoursJson: data.workingHoursJson ?? null,
        iconMedia: null,
        coverMedia: null,
      }),
    },
  };
  const service = new ServicesService(prisma, audit, searchIndexer, cache);
  return { service, invalidated };
}

const user = { id: 'user-1' };

test('create/update/delete invalidate public mall cache after persist', async () => {
  const { service, invalidated } = makeService();
  await service.create({ name: 'Vale' }, user, 'tenant', 'mall');
  await service.update('svc-1', { name: 'Vale+', status: 'INACTIVE' }, user, 'tenant');
  await service.remove('svc-1', user, 'tenant');
  assert.deepEqual(invalidated, [
    { tenantId: 'tenant', mallId: 'mall' },
    { tenantId: 'tenant', mallId: 'mall' },
    { tenantId: 'tenant', mallId: 'mall' },
  ]);
});

test('cache invalidation failure does not fail the mutation', async () => {
  const { service, invalidated } = makeService({
    invalidateError: new Error('redis down'),
  });
  const updated = await service.update(
    'svc-1',
    {
      workingHoursJson: {
        monday: { open: true, from: '10:00', to: '20:00' },
      },
    },
    user,
    'tenant',
  );
  assert.equal(updated.id, 'svc-1');
  assert.equal(invalidated.length, 1);
});
