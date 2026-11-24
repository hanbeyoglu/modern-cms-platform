const assert = require('node:assert/strict');
const { test } = require('node:test');
const { AuthService } = require('../dist/auth/auth.service');

test('normal-user profile only exposes assigned nondeleted malls belonging to the membership tenant', async () => {
  const mall = (id, tenantId = 'tenant', deletedAt = null) => ({ id, tenantId, deletedAt, name: id, slug: id, status: 'LIVE', type: 'MALL', logoMedia: null, coverMedia: null });
  const makeService = malls => new AuthService({ tenantUser: { findMany: async () => [{ tenantId: 'tenant', tenant: { name: 'Tenant' }, role: { code: 'MALL_MANAGER', name: 'Manager', rolePermissions: [] }, mallAccess: malls.map(mall => ({ mall })) }] } }, {}, {}, { listTenantsForUser: async () => [{ id: 'tenant' }] }, {}, { getEnabledCodesForTenant: async () => new Set() });
  const result = await makeService([mall('allowed'), mall('deleted', 'tenant', new Date()), mall('foreign', 'other')]).me({ id: 'user', isSuperAdmin: false });
  assert.deepEqual(result.memberships[0].malls.map(m => m.id), ['allowed']);
  const empty = await makeService([]).me({ id: 'user', isSuperAdmin: false });
  assert.deepEqual(empty.memberships[0].malls, []);
});
