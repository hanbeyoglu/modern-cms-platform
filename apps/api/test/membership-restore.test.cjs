const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Prisma } = require('@prisma/client');
const { UsersService } = require('../dist/users/users.service');
function fixture(existing, failure) {
  const writes = []; const audit = [];
  const prisma = {
    tenant: { findFirst: async () => ({ id: 't' }) },
    role: { findFirst: async () => ({ id: 'role', code: 'MALL_MANAGER' }) },
    mall: { findMany: async () => [{ id: 'new-mall' }] },
    tenantUser: {
      findFirst: async () => null,
      findUnique: async ({ where }) => { assert.deepEqual(where, { tenantId_userId: { tenantId: 't', userId: 'u' } }); return existing; },
      create: async args => { if (failure) throw failure; writes.push(args); return { id: 'created' }; },
      update: async args => { if (failure) throw failure; writes.push(args); return { id: 'restored' }; },
    },
  };
  return { service: new UsersService(prisma, { logAction: async args => audit.push(args) }), writes, audit };
}
const actor = { id: 'admin', isSuperAdmin: true };
const dto = { tenantId: 't', roleId: 'role', mallIds: ['new-mall'] };
test('soft-deleted membership restores atomically with new role and only newly assigned malls', async () => {
  const deletedAt = new Date(); const f = fixture({ id: 'old', deletedAt });
  const result = await f.service.addMembership(actor, 'u', dto);
  assert.equal(result.membershipId, 'restored');
  assert.deepEqual(f.writes[0], { where: { id: 'old', deletedAt }, data: { roleId: 'role', isActive: true, deletedAt: null, mallAccess: { deleteMany: {}, create: [{ mallId: 'new-mall' }] } } });
  assert.equal(f.audit[0].action, 'membership_restored');
});
test('existing membership, including inactive, returns conflict without changing access', async () => {
  const f = fixture({ id: 'existing', deletedAt: null, isActive: false });
  await assert.rejects(f.service.addMembership(actor, 'u', dto), { status: 409 });
  assert.equal(f.writes.length, 0);
});
test('new membership is created; concurrent duplicate or restore returns 409 rather than 500', async () => {
  const f = fixture(null); await f.service.addMembership(actor, 'u', dto);
  assert.equal(f.writes[0].data.userId, 'u');
  for (const [existing, code] of [[null, 'P2002'], [{ id: 'old', deletedAt: new Date() }, 'P2025']]) {
    const f = fixture(existing, new Prisma.PrismaClientKnownRequestError('test', { code, clientVersion: 'test' }));
    await assert.rejects(f.service.addMembership(actor, 'u', dto), { status: 409 });
    assert.equal(f.audit.length, 0);
  }
});
test('tenant authorization is checked before any restore', async () => {
  const f = fixture({ id: 'old', deletedAt: new Date() });
  await assert.rejects(f.service.addMembership({ id: 'member', isSuperAdmin: false }, 'u', dto), { status: 403 });
  assert.equal(f.writes.length, 0);
});
