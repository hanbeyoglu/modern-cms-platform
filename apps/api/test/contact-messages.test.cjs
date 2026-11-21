const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { ContactMessagesService } = require('../dist/contact-messages/contact-messages.service');
const { CreateContactMessageDto, ListContactMessagesDto } = require('../dist/contact-messages/dto/contact-message.dto');
const { PublicContactMessagesController } = require('../dist/public/public-contact-messages.controller');
const { ContactRateLimitGuard } = require('../dist/public/guards/contact-rate-limit.guard');
const { MallAccessGuard } = require('../dist/access/guards/mall-access.guard');
const { PermissionsGuard } = require('../dist/access/guards/permissions.guard');
const { RequireMallContext } = require('../dist/common/decorators/require-mall.decorator');
const { RequirePermission } = require('../dist/common/decorators/require-permission.decorator');

const payload = { name: 'Visitor', email: 'visitor@example.test', message: 'Hello mall', kvkkConsent: true };
const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = value => pipe.transform(value, { type: 'body', metatype: CreateContactMessageDto });
function fixture(initial = [], { supportEmail = null, enqueue = async () => undefined } = {}) {
  const rows = initial.map(row => ({
    tenantId: 'tenant',
    mallId: 'mall',
    status: 'NEW',
    readAt: null,
    archivedAt: null,
    emailNotificationStatus: 'SKIPPED',
    emailNotificationSentAt: null,
    emailNotificationAttempts: 0,
    ...row,
  }));
  const calls = [];
  const queueCalls = [];
  const match = (row, where) => Object.entries(where).every(([key, value]) => key === 'OR' ? value.some(part => match(row, part)) : value && typeof value === 'object' ?
    ('contains' in value ? String(row[key] ?? '').toLowerCase().includes(value.contains.toLowerCase()) : Object.entries(value).every(([op, date]) => op === 'gte' ? row[key] >= date : op === 'lt' ? row[key] < date : row[key] <= date)) : row[key] === value);
  const prisma = {
    mall: {
      findFirst: async ({ where, select }) => {
        if (!(where.id === 'mall' && where.tenantId === 'tenant')) return null;
        if (select?.supportEmail !== undefined) return { id: 'mall', supportEmail };
        return { id: 'mall' };
      },
    },
    contactMessage: {
      create: async ({ data, select }) => {
        calls.push(data);
        const row = { id: 'new', status: 'NEW', ...data };
        rows.push(row);
        if (select) {
          const picked = {};
          for (const key of Object.keys(select)) picked[key] = row[key];
          return picked;
        }
        return { id: 'new' };
      },
      findMany: async args => { calls.push(args); return rows.filter(row => match(row, args.where)).sort((a,b) => b.createdAt - a.createdAt).slice(args.skip, args.skip + args.take); },
      count: async ({ where }) => rows.filter(row => match(row, where)).length,
      findFirst: async ({ where }) => rows.find(row => match(row, where)) ?? null,
      findFirstOrThrow: async ({ where }) => { const row = rows.find(row => match(row, where)); if (!row) throw new Error('missing'); return row; },
      updateMany: async ({ where, data }) => { const selected = rows.filter(row => match(row, where)); selected.forEach(row => Object.assign(row, data)); return { count: selected.length }; },
    },
  };
  const emailQueue = {
    enqueueNotification: async (data) => {
      queueCalls.push(data);
      return enqueue(data);
    },
  };
  return { service: new ContactMessagesService(prisma, emailQueue), rows, calls, queueCalls, prisma, emailQueue };
}

test('public DTO trims inputs, validates bounds and rejects forged scope and missing consent', async () => {
  assert.equal((await validate({ ...payload, name: '  Visitor  ' })).name, 'Visitor');
  for (const bad of [{ name: ' ' }, { name: 'n'.repeat(121) }, { email: 'invalid' }, { email: `${'a'.repeat(245)}@example.test` }, { phone: '1'.repeat(31) }, { subject: 's'.repeat(181) }, { message: '' }, { message: 'm'.repeat(5001) }, { kvkkConsent: false }, { kvkkConsent: 'true' }, { tenantId: 'foreign' }, { mallId: 'foreign' }]) {
    await assert.rejects(validate({ ...payload, ...bad }));
  }
  const { kvkkConsent, ...withoutConsent } = payload;
  await assert.rejects(validate(withoutConsent));
  await validate({ ...payload, name: 'n'.repeat(120), phone: '1'.repeat(30), subject: 's'.repeat(180), message: 'm'.repeat(5000) });
});

test('submission stores server-side consent timestamp without returning visitor content; honeypot is rejected', async () => {
  const { service, calls } = fixture();
  const before = Date.now();
  assert.deepEqual(await service.submit({ tenantId: 'tenant', mallId: 'mall' }, await validate(payload)), { accepted: true });
  assert.equal(calls[0].tenantId, 'tenant'); assert.equal(calls[0].mallId, 'mall');
  assert.equal(calls[0].emailNotificationStatus, 'SKIPPED');
  assert.ok(calls[0].kvkkConsentAt.getTime() >= before);
  await assert.rejects(service.submit({ tenantId: 'tenant', mallId: 'mall' }, { ...payload, website: 'spam' }));
  assert.equal(calls.length, 1);
});

test('submission with mall supportEmail marks PENDING and enqueues job with message id', async () => {
  const { service, calls, queueCalls } = fixture([], { supportEmail: 'support@mall.example' });
  assert.deepEqual(await service.submit({ tenantId: 'tenant', mallId: 'mall' }, await validate(payload)), { accepted: true });
  assert.equal(calls[0].emailNotificationStatus, 'PENDING');
  assert.deepEqual(queueCalls, [{ messageId: 'new', tenantId: 'tenant', mallId: 'mall' }]);
});

test('enqueue failure keeps the message and still returns accepted', async () => {
  const { service, rows, queueCalls } = fixture([], {
    supportEmail: 'support@mall.example',
    enqueue: async () => { throw new Error('redis down'); },
  });
  assert.deepEqual(await service.submit({ tenantId: 'tenant', mallId: 'mall' }, await validate(payload)), { accepted: true });
  assert.equal(queueCalls.length, 1);
  assert.equal(rows[0].emailNotificationStatus, 'PENDING');
  assert.equal(rows.length, 1);
});

test('public scope comes from key context and rejects mismatched header or mall; DB errors do not expose content', async () => {
  const { service, prisma } = fixture();
  const contexts = [];
  const controller = new PublicContactMessagesController({ resolve: async (...args) => { contexts.push(args); return { tenantId: args[0], mallId: args[1], locale: { code: 'tr' } }; } }, service);
  const req = { tenantId: 'tenant', mallId: 'mall', header: () => 'tenant' };
  const result = await controller.submit(req, payload, 'tr');
  assert.deepEqual(contexts[0], ['tenant', 'mall', 'tr']); assert.equal(result.success, true);
  assert.deepEqual(result.data, { accepted: true });
  await assert.rejects(controller.submit({ ...req, header: () => 'foreign' }, payload), { status: 403 });
  await assert.rejects(controller.submit({ ...req, mallId: undefined }, payload), { status: 400 });
  prisma.contactMessage.create = async () => { throw new Error('database error containing secret visitor message'); };
  await assert.rejects(service.submit({ tenantId: 'tenant', mallId: 'mall' }, payload), error => error.getStatus() === 503 && !error.message.includes('secret'));
});

test('admin scope, filtering, pagination, detail, count and status mutations never cross tenant/mall boundaries', async () => {
  const { service, rows, calls } = fixture([
    { id: 'one', name: 'Visitor', email: 'v@example.test', message: 'hello', createdAt: new Date('2026-11-21T10:00:00Z') },
    { id: 'two', name: 'Visitor', email: 'v@example.test', message: 'hello', createdAt: new Date('2026-11-21T12:00:00Z') },
    { id: 'foreign-tenant', tenantId: 'other', createdAt: new Date() },
    { id: 'foreign-mall', mallId: 'other', createdAt: new Date() },
  ]);
  const query = await pipe.transform({ page: '2', limit: '1', search: 'hello', from: '2026-11-21', to: '2026-11-21' }, { type: 'query', metatype: ListContactMessagesDto });
  const result = await service.list('tenant', 'mall', query);
  assert.deepEqual(result.items.map(row => row.id), ['one']); assert.equal(result.pagination.totalPages, 2);
  assert.equal(calls[0].select.message, undefined);
  assert.deepEqual(await service.unreadCount('tenant', 'mall'), { count: 2 });
  await assert.rejects(service.list('tenant', undefined, query), { status: 400 });
  await assert.rejects(service.list('tenant', 'other', query), { status: 404 });
  for (const id of ['foreign-tenant', 'foreign-mall']) {
    await assert.rejects(service.detail('tenant', 'mall', id), { status: 404 });
    await assert.rejects(service.updateStatus('tenant', 'mall', id, 'ARCHIVED'), { status: 404 });
    assert.equal(rows.find(row => row.id === id).status, 'NEW');
  }
  const opened = await service.detail('tenant', 'mall', 'one');
  assert.equal(opened.status, 'READ'); assert.ok(opened.readAt instanceof Date);
  const readAt = opened.readAt;
  await service.detail('tenant', 'mall', 'one'); assert.equal(opened.readAt, readAt);
  await service.updateStatus('tenant', 'mall', 'one', 'ARCHIVED'); assert.ok(opened.archivedAt instanceof Date);
  await service.updateStatus('tenant', 'mall', 'one', 'READ'); assert.equal(opened.archivedAt, null);
  await service.updateStatus('tenant', 'mall', 'one', 'NEW'); assert.equal(opened.readAt, null);
  assert.deepEqual(await service.list('tenant', 'mall', { page: 1, limit: 20, status: 'ARCHIVED' }), { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
});

test('IP limit rejects sixth submission, ignores spoofed forwarding headers and fails closed when Redis is unavailable', async () => {
  const counters = new Map(); const keys = [];
  const guard = new ContactRateLimitGuard({ increment: async (key, ttl) => { keys.push(key); assert.equal(ttl, 600); const value = (counters.get(key) ?? 0) + 1; counters.set(key, value); return value; } });
  const req = { tenantId: 'tenant', mallId: 'mall', ip: '203.0.113.1', headers: {}, socket: {} };
  const headers = {};
  const context = { switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ setHeader: (k,v) => { headers[k] = v; } }) }) };
  for (let i = 0; i < 5; i++) { req.headers['x-forwarded-for'] = `fake-${i}`; await guard.canActivate(context); }
  await assert.rejects(guard.canActivate(context), { status: 429 }); assert.equal(headers['Retry-After'], '600');
  assert.equal(new Set(keys).size, 1);
  req.ip = '203.0.113.2'; await guard.canActivate(context);
  const unavailable = new ContactRateLimitGuard({ increment: async () => 0 });
  await assert.rejects(unavailable.canActivate(context), { status: 503 });
});

test('existing permission/mall guards enforce message permissions and AVM membership', async () => {
  class Controller {}
  function handler() {}
  RequireMallContext()(Controller);
  RequirePermission('contact-message:read')(Controller.prototype, 'read', { value: handler });
  const req = { user: { id: 'user', isSuperAdmin: false }, tenantId: 'tenant', mallId: 'foreign' };
  const context = { getClass: () => Controller, getHandler: () => handler, switchToHttp: () => ({ getRequest: () => req }) };
  const { ForbiddenException } = require('@nestjs/common');
  const mallGuard = new MallAccessGuard(new Reflector(), { assertMallAccess: async () => { throw new ForbiddenException(); } });
  await assert.rejects(mallGuard.canActivate(context), { status: 403 });
  const permissionGuard = new PermissionsGuard(new Reflector(), { getEffectivePermissionCodes: async () => new Set() });
  await assert.rejects(permissionGuard.canActivate(context), { status: 403 });
});

test('OpenAPI exposes only POST publicly, with required mall and API key and no scope body fields', () => {
  const doc = require('../openapi/openapi.json'); const path = doc.paths['/public/contact-messages'];
  assert.ok(path.post); assert.equal(path.get, undefined); assert.equal(path.delete, undefined); assert.equal(path.patch, undefined);
  assert.ok(path.post.security.some(item => 'apiKey' in item));
  assert.ok(path.post.parameters.some(item => item.name === 'x-mall-id' && item.required));
  const schema = doc.components.schemas.CreateContactMessageDto;
  assert.equal(schema.properties.tenantId, undefined); assert.equal(schema.properties.mallId, undefined);
  assert.equal(schema.properties.message.maxLength, 5000);
});
