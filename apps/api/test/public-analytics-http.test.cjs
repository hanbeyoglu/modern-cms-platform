require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Module, ValidationPipe, NotFoundException } = require('@nestjs/common');
const { NestFactory, Reflector } = require('@nestjs/core');
const { Prisma } = require('@prisma/client');
const { PublicAnalyticsController } = require('../dist/analytics/public-analytics.controller');
const { AnalyticsService } = require('../dist/analytics/analytics.service');
const { PublicApiKeyGuard } = require('../dist/public/guards/public-api-key.guard');
const { AnalyticsRateLimitGuard } = require('../dist/analytics/analytics-rate-limit.guard');
const { DeveloperApiService } = require('../dist/developer-api/developer-api.service');
const { PublicCacheService } = require('../dist/public/cache/public-cache.service');
const { JwtAuthGuard } = require('../dist/auth/guards/jwt-auth.guard');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { TenantContextMiddleware } = require('../dist/common/middleware/tenant-context.middleware');

test('public HTTP ingestion preserves key/domain/scope/capability checks without an admin JWT', async () => {
  const rows = [];
  let enabled = false;
  const prisma = {
    tenantCapability: { findFirst: async ({ where }) => {
      assert.deepEqual(where, { tenantId: 'tenant', enabled: true, capability: { code: 'analytics' } });
      return enabled ? { id: 'enabled' } : null;
    } },
    mallStore: { findMany: async ({ where }) => {
      assert.equal(where.tenantId, 'tenant'); assert.equal(where.mallId, 'mall');
      return where.id.in.includes('public-store') ? [{ id: 'public-store', detailTitle: 'Adidas' }] : [];
    } },
    analyticsEvent: {
      create: async ({ data }) => {
        if (rows.some(row => row.clientEventId === data.clientEventId))
          throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' });
        const row = { id: String(rows.length), ...data }; rows.push(row); return row;
      },
      findUnique: async ({ where }) => rows.find(row => Object.entries(where.tenantId_mallId_clientEventId).every(([key, value]) => row[key] === value)),
    },
  };
  const service = new AnalyticsService(prisma, {}, { get: () => 'test' }, {
    resolve: async (tenant, mall) => {
      if (tenant !== 'tenant' || mall !== 'mall') throw new NotFoundException('Mall not found for this tenant');
      return { locale: { code: 'tr' } };
    },
  });
  const developerApi = {
    validateApiKey: async key => key === 'test-key' ? { tenantId: 'tenant', keyId: 'test-id' } : null,
    getAllowedDomains: async () => ['metrogarden.hanbeyoglu.com'],
    getRateLimitValue: async () => 500,
    touchLastUsed: async () => {}, logRequest: async () => {},
  };
  class ProbeModule {}
  Module({ controllers: [PublicAnalyticsController], providers: [
    { provide: AnalyticsService, useValue: service },
    { provide: DeveloperApiService, useValue: developerApi },
    { provide: PublicCacheService, useValue: { get: async () => null, set: async () => {}, increment: async () => 1 } },
    PublicApiKeyGuard, AnalyticsRateLimitGuard,
  ] })(ProbeModule);
  const app = await NestFactory.create(ProbeModule, { logger: false });
  app.use(new TenantContextMiddleware().use);
  app.useGlobalGuards(new JwtAuthGuard(new Reflector()));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  try {
    await app.listen(0, '127.0.0.1');
    const url = `${await app.getUrl()}/public/analytics/track`;
    const page = { clientEventId: 'a60fe38f-6bde-42b4-bf97-5d57a4b5f6c6', entityType: 'PAGE', eventType: 'PAGE_VIEW', path: '/stores/adidas', locale: 'tr', metadataJson: { source: 'route' } };
    const send = async (body = page, headers = {}) => {
      const response = await fetch(url, { method: 'POST', headers: {
        'Content-Type': 'application/json', 'x-api-key': 'test-key', 'x-tenant-id': 'tenant', 'x-mall-id': 'mall', Origin: 'https://metrogarden.hanbeyoglu.com', ...headers,
      }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    const disabled = await send();
    assert.equal(disabled.status, 403); assert.equal(disabled.body.error.code, 'FORBIDDEN');
    assert.match(disabled.body.error.message, /analytics/); assert.equal(rows.length, 0);
    enabled = true; // Same authorized capability setting; not a guard bypass.
    const accepted = { status: 201, body: { success: true, data: { accepted: true } } };
    assert.deepEqual(await send(), accepted);
    assert.deepEqual(await send(), accepted); assert.equal(rows.length, 1); assert.equal(rows[0].entityId, null);
    const store = { ...page, clientEventId: '1aecc5b6-cba8-4995-8270-a1da296cb129', entityType: 'STORE', entityId: 'public-store', eventType: 'STORE_VIEW' };
    assert.deepEqual(await send(store), accepted); assert.equal(rows.length, 2);
    for (const [body, headers, status] of [
      [page, { 'x-api-key': 'invalid' }, 401], [page, { 'x-api-key': '' }, 401],
      [page, { Origin: 'https://evil.example' }, 403],
      [page, { 'x-tenant-id': 'other' }, 403], [page, { 'x-mall-id': 'other' }, 404],
      [page, { 'x-mall-id': '' }, 400], [{ ...store, entityId: 'another-mall-store' }, {}, 404],
      [{ ...store, entityId: undefined }, {}, 400], [{ ...page, tenantId: 'forged' }, {}, 400],
    ]) assert.equal((await send(body, headers)).status, status);
    assert.equal(rows.length, 2);
  } finally { await app.close(); }
});
