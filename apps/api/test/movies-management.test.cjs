const assert = require('node:assert/strict');
const { test } = require('node:test');
const { MoviesService } = require('../dist/movies/movies.service');

test('manual movie creation retains chosen listing status and can reuse a deleted title with a distinct slug', async () => {
  let inserted;
  const service = new MoviesService({ movie: {
    findFirst: async ({ where }) => where.slug === 'manual' ? { id: 'deleted', deletedAt: new Date() } : null,
    create: async ({ data }) => { inserted = data; return { id: 'new', ...data }; },
  } }, { logAction: async () => {} }, { syncMovie: async () => {} });
  await service.create({ title: 'Manual', listingStatus: 'UPCOMING' }, { id: 'editor' }, 'tenant');
  assert.equal(inserted.title, 'Manual');
  assert.equal(inserted.slug, 'manual-1');
  assert.equal(inserted.listingStatus, 'UPCOMING');
  assert.equal(inserted.status, 'ACTIVE');
  assert.equal(inserted.tmdbId, undefined);
});

test('management listing applies display group, provider and category filters before pagination', async () => {
  let query;
  const service = new MoviesService({ movie: {
    findMany: async args => { query = args; return []; }, count: async () => 0,
  } }, {}, {});
  await service.list('tenant', { listingStatus: 'NOW_PLAYING', provider: 'MANUAL', categoryId: 'category', page: 2, limit: 20 });
  assert.equal(query.where.tenantId, 'tenant');
  assert.equal(query.where.deletedAt, null);
  assert.equal(query.where.listingStatus, 'NOW_PLAYING');
  assert.equal(query.where.provider, 'MANUAL');
  assert.deepEqual(query.where.categories, { some: { categoryId: 'category' } });
  assert.equal(query.skip, 20);
});
