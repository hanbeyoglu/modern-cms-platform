const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const { JwtService } = require('@nestjs/jwt');
const { ConfigService } = require('@nestjs/config');
const bcrypt = require('bcrypt');
const { AuthService } = require('../dist/auth/auth.service');
const { UsersService } = require('../dist/users/users.service');

const jwt = new JwtService({ secret: 'test-only-secret-at-least-thirty-two-characters' });
const user = { id: 'user-1', email: 'test@example.test', isSuperAdmin: false };
const audit = { logAction: async () => {} };

for (const [configured, expected] of [['60', 60], ['invalid', 900], ['0', 900]]) {
  test(`access JWT has an enforced expiry when TTL is ${configured}`, async () => {
    const hash = await bcrypt.hash('test-password', 4);
    const service = new AuthService(
      { tenantSetting: { findMany: async () => [] }, refreshToken: { create: async () => {} } }, jwt,
      { get: (key, fallback) => key === 'JWT_ACCESS_TTL' ? configured : fallback },
      { findActiveUserByEmail: async () => ({ ...user, passwordHash: hash }) }, audit, {},
    );
    const result = await service.login(user.email, 'test-password', {});
    const claims = await jwt.verifyAsync(result.accessToken);
    assert.equal(claims.exp - claims.iat, expected);
    assert.equal(result.expiresIn, expected);
  });
}

test('simultaneous refresh requests cannot both consume the same token', async () => {
  const raw = 'test-refresh-token';
  const existing = { id: 'refresh-1', userId: user.id, tokenHash: createHash('sha256').update(raw).digest('hex'), expiresAt: new Date(Date.now() + 60000) };
  let claimed = false;
  let created = 0;
  const service = new AuthService({ tenantSetting: { findMany: async () => [] }, refreshToken: {
    findFirst: async () => existing,
    updateMany: async () => {
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    },
    create: async () => { created++; },
  } }, jwt, new ConfigService(), { findActiveUserById: async () => user }, audit, {});
  const results = await Promise.allSettled([service.refresh(raw, {}), service.refresh(raw, {})]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.equal(created, 1);
});

test('expired refresh tokens do not issue another session', async () => {
  const service = new AuthService({ tenantSetting: { findMany: async () => [] }, refreshToken: {
    findFirst: async () => ({ expiresAt: new Date(0) }),
  } }, jwt, new ConfigService(), {}, audit, {});
  await assert.rejects(service.refresh('expired', {}), { status: 401 });
});

test('administrator password reset stores a hash and revokes refresh tokens together', async () => {
  let passwordHash;
  let revoked = false;
  let transaction = false;
  const service = new UsersService({
    tenantSetting: { findMany: async () => [] },
    user: {
      findFirst: async () => ({ ...user, tenantUsers: [], createdAt: new Date(), updatedAt: new Date() }),
      update: async ({ data }) => { passwordHash = data.passwordHash; },
    },
    refreshToken: { updateMany: async () => { revoked = true; } },
    $transaction: async (operations) => { transaction = true; return Promise.all(operations); },
  }, audit);
  const result = await service.resetPassword({ id: 'admin', isSuperAdmin: true }, user.id, { newPassword: 'new-test-password' });
  assert.equal(result.success, true);
  assert.equal(transaction, true);
  assert.equal(revoked, true);
  assert.notEqual(passwordHash, 'new-test-password');
  assert.equal(await bcrypt.compare('new-test-password', passwordHash), true);
});

test('tenant administrator cannot reset a platform administrator password', async () => {
  const tenant = { id: 'tenant-1', name: 'Test', slug: 'test' };
  const service = new UsersService({
    tenantSetting: { findMany: async () => [] },
    user: { findFirst: async () => ({ ...user, isSuperAdmin: true, tenantUsers: [
      { id: 'membership', tenantId: tenant.id, tenant, role: { id: 'role', code: 'SUPER_ADMIN', name: 'Admin' }, mallAccess: [] },
    ] }) },
    tenantUser: { findFirst: async () => ({ tenantId: tenant.id }) },
  }, audit);
  await assert.rejects(service.resetPassword(user, 'platform-admin', { newPassword: 'new-test-password' }, 'tenant-1'), { status: 403 });
});

const { assertPasswordPolicy, getSecurityPolicy } = require('../dist/common/security-policy');
const { AuditLogService } = require('../dist/audit/audit.service');

test('strong password policy rejects missing case or symbol and accepts Turkish letters', () => {
  assert.throws(() => assertPasswordPolicy('abcdefghijkl', 'strong'), { status: 400 });
  assert.throws(() => assertPasswordPolicy('Abcdefghijkl', 'strong'), { status: 400 });
  assert.doesNotThrow(() => assertPasswordPolicy('ŞifreDeneme!12', 'strong'));
  assert.throws(() => assertPasswordPolicy('ş'.repeat(37), 'default'), { status: 400 });
});

test('multiple memberships apply the strictest password policy and shortest configured session', async () => {
  const policy = await getSecurityPolicy({ tenantSetting: { findMany: async () => [
    { value: { sessionTimeoutMinutes: 120, passwordPolicy: 'strong' } },
    { value: { sessionTimeoutMinutes: 30, passwordPolicy: 'medium' } },
  ] } }, { userId: user.id });
  assert.equal(policy.sessionTimeoutMinutes, 30);
  assert.equal(policy.passwordPolicy, 'strong');
});

test('invalid membership input cannot leave an orphan user account', async () => {
  let creates = 0;
  const service = new UsersService({
    user: { findFirst: async () => null, create: async () => { creates++; } },
    tenant: { findFirst: async () => ({ id: 'tenant-a' }) },
    role: { findFirst: async () => null },
  }, audit);
  await assert.rejects(service.create({ isSuperAdmin: true }, {
    email: user.email, password: 'test-password', tenantId: 'tenant-a', roleId: 'foreign-role',
  }), { status: 404 });
  assert.equal(creates, 0);
});

test('audit reads reject missing tenant scope for non-platform users', async () => {
  const service = new AuditLogService({}, new ConfigService());
  await assert.rejects(service.list(user, {}), { status: 403 });
  await assert.rejects(service.findOne('log', user), { status: 403 });
  await assert.rejects(service.timeline('event', 'event-1', user), { status: 403 });
});

const { LocalStorageProvider } = require('../dist/media/storage/local-storage.provider');
const { PublicContextService } = require('../dist/public/public-context.service');

test('local media storage rejects traversal and absolute keys before writing', async () => {
  const storage = new LocalStorageProvider({ storageRoot: '/tmp/cms-test-media', baseUrl: 'http://cms.test' });
  for (const key of ['../escape.jpg', '/../../escape.jpg', 'folder/../../escape.jpg', '..\\escape.jpg']) {
    await assert.rejects(storage.upload({ key, buffer: Buffer.from('test') }), { status: 400 });
    await assert.rejects(storage.delete(key), { status: 400 });
  }
});

test('maintenance mode blocks public content before locale or content queries', async () => {
  const service = new PublicContextService({
    tenant: { findFirst: async () => ({ id: 'tenant-a', status: 'ACTIVE' }) },
    tenantSetting: { findUnique: async () => ({ value: { maintenanceMode: true } }) },
  }, {});
  await assert.rejects(service.resolve('tenant-a'), { status: 503 });
});

test('invalid AVM assignment does not remove existing membership access', async () => {
  let updates = 0;
  const service = new UsersService({
    tenantUser: {
      findFirst: async () => ({ id: 'membership', tenantId: 'tenant-a' }),
      update: async () => { updates++; },
    },
    mall: { findMany: async () => [] },
  }, audit);
  await assert.rejects(service.updateMembership({ isSuperAdmin: true }, 'user', 'membership', { mallIds: ['foreign-mall'] }), { status: 400 });
  assert.equal(updates, 0);
});
