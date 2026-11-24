const assert = require('node:assert/strict');
const { test } = require('node:test');
const { SearchService } = require('../dist/search/search.service');
const { SearchQueryBuilder } = require('../dist/search/search-query-builder');
const { SearchNormalizerService } = require('../dist/search/search-normalizer.service');
const { SearchRankingService } = require('../dist/search/search-ranking.service');
const { SearchResultMapperService } = require('../dist/search/search-result-mapper.service');

function setup() {
  const queries = [];
  const accesses = [];
  const prisma = {
    tenantUser: { findFirst: async () => ({ id: 'member', role: { code: 'MALL_MANAGER' } }) },
    userMallAccess: { findMany: async () => [{ mallId: 'mall-a' }, { mallId: 'mall-b' }] },
    mall: { findMany: async () => [{ id: 'mall-a', slug: 'a', name: 'AVM A' }] },
    $queryRaw: async (sql) => {
      queries.push(sql);
      return [
        {
          entityType: 'CAMPAIGN',
          entityId: 'campaign',
          title: 'Gerçek kampanya',
          mallId: 'mall-a',
          tenantId: 'tenant',
          score: 1,
          status: 'DRAFT',
        },
        {
          entityType: 'MOVIE',
          entityId: 'movie',
          title: 'Yetkisiz film',
          mallId: null,
          tenantId: 'tenant',
          score: 1,
          status: 'ACTIVE',
        },
      ];
    },
  };
  const access = {
    assertMallAccess: async (_user, tenant, mall) => {
      accesses.push([tenant, mall]);
      if (tenant !== 'tenant' || !['mall-a', 'mall-b'].includes(mall))
        throw new Error('forbidden mall');
    },
    getEffectivePermissionCodes: async () => new Set(['campaign:read']),
  };
  return {
    queries,
    accesses,
    service: new SearchService(
      prisma,
      access,
      new SearchQueryBuilder(new SearchNormalizerService()),
      new SearchRankingService(),
      new SearchResultMapperService(),
    ),
  };
}
test('selected workspace is validated and never expands to other assigned malls', async () => {
  const f = setup();
  const result = await f.service.globalSearch({ id: 'user' }, 'tenant', 'Gerçek', 6, 'mall-a');
  assert.deepEqual(f.accesses, [['tenant', 'mall-a']]);
  const sql = f.queries[0];
  assert.ok(sql.values.includes('tenant'));
  assert.ok(sql.values.includes('mall-a'));
  assert.ok(!sql.values.includes('mall-b'));
  assert.doesNotMatch(sql.sql, /OR s\."mallId" IN/);
  assert.equal(result.campaigns[0].title, 'Gerçek kampanya');
  assert.equal(result.campaigns[0].mallName, 'AVM A');
  assert.deepEqual(result.movies, []);
  await assert.rejects(
    f.service.globalSearch({ id: 'user' }, 'tenant', 'x', 6, 'forbidden'),
    /forbidden mall/,
  );
  assert.equal(f.queries.length, 1);
});
test('super admin still validates an explicit mall; no-workspace search retains assigned scopes', async () => {
  const f = setup();
  await assert.rejects(
    f.service.globalSearch({ isSuperAdmin: true }, 'tenant', 'x', 6, 'foreign-mall'),
    /forbidden mall/,
  );
  await f.service.globalSearch({ id: 'user' }, 'tenant', 'x', 6);
  assert.ok(f.queries[0].values.includes('mall-a'));
  assert.ok(f.queries[0].values.includes('mall-b'));
});
test('blank query returns empty lists without database calls or fabricated results', async () => {
  const f = setup();
  const result = await f.service.globalSearch({ id: 'user' }, 'tenant', '  ', 6, 'mall-a');
  assert.ok(Object.values(result).every((rows) => rows.length === 0));
  assert.equal(f.queries.length, 0);
});
