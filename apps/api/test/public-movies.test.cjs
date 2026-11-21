const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PublicContentService } = require('../dist/public/public-content.service');
const { PublicController } = require('../dist/public/public.controller');

const base = { tenantId: 'tenant', status: 'ACTIVE', deletedAt: null, publishStartAt: null,
  publishEndAt: null, title: 'Original', slug: 'original', description: 'Description',
  durationMinutes: 120, releaseDate: new Date('2026-01-01'), ticketUrl: null,
  posterMedia: null, categories: [], providerRaw: { secret: 'private' } };

// In-memory Prisma boundary: execute the query predicates and pagination against fixtures.
// No session delegate exists: any dependency on sessions would fail these tests.
function fixture(rows, translations = {}) {
  const calls = [];
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'AND') return value.every(part => matches(row, part));
      if (key === 'OR') return value.some(part => matches(row, part));
      if (value && typeof value === 'object') {
        if ('lte' in value) return row[key] != null && row[key] <= value.lte;
        if ('gte' in value) return row[key] != null && row[key] >= value.gte;
        throw new Error(`Unsupported predicate: ${key}`);
      }
      return row[key] === value;
    });
  }
  const prisma = { movie: {
    findMany: async args => { calls.push(args); return rows.filter(row => matches(row, args.where)).slice(args.skip, args.skip + args.take); },
    count: async ({ where }) => rows.filter(row => matches(row, where)).length,
  } };
  const resolver = { getTranslationsForEntities: async (tenant, locale, type, ids) => {
    assert.equal(tenant, 'tenant'); assert.equal(locale, 'locale-tr');
    return Object.fromEntries(ids.filter(id => translations[type]?.[id]).map(id => [id, translations[type][id]]));
  } };
  const content = new PublicContentService(prisma, resolver);
  return { content, calls };
}
const options = { tenantId: 'tenant', mallId: 'mall', page: 1, limit: 100 };

test('active films without sessions are public; inactive, deleted, foreign and unpublished films are excluded', async () => {
  const { content, calls } = fixture([
    { ...base, id: 'no-sessions' },
    { ...base, id: 'in-window', publishStartAt: new Date('2000-01-01'), publishEndAt: new Date('2099-01-01') },
    { ...base, id: 'inactive', status: 'PASSIVE' },
    { ...base, id: 'archived', status: 'ARCHIVED' },
    { ...base, id: 'deleted', deletedAt: new Date() },
    { ...base, id: 'future', publishStartAt: new Date('2099-01-01') },
    { ...base, id: 'expired', publishEndAt: new Date('2000-01-01') },
    { ...base, id: 'foreign', tenantId: 'another' },
  ]);
  const result = await content.getMovies(options);
  assert.deepEqual(result.items.map(movie => movie.id), ['no-sessions', 'in-window']);
  assert.equal(result.total, 2);
  assert.equal(result.items[0].poster, null);
  assert.deepEqual(Object.keys(result.items[0]).sort(), ['id','title','slug','description','durationMinutes','releaseDate','ticketUrl','poster','categories'].sort());
  assert.equal(calls[0].select.providerRaw, undefined);
  assert.equal(calls[0].select.movieSessions, undefined);
  assert.deepEqual(calls[0].orderBy, [{ sortOrder: 'asc' }, { title: 'asc' }, { id: 'asc' }]);
});

test('movie and category translations, fallback and minimal poster projection', async () => {
  const { content } = fixture([{ ...base, id: 'film',
    posterMedia: { id: 'poster', publicUrl: 'https://cdn.test/poster.jpg', altText: 'Poster', secret: 'hidden' },
    categories: [{ category: { id: 'category', name: 'Action', slug: 'action' } }, { category: { id: 'fallback', name: 'Drama', slug: 'drama' } }],
  }], { MOVIE: { film: { title: 'Türkçe film', description: 'Türkçe açıklama' } }, MOVIE_CATEGORY: { category: { name: 'Aksiyon' } } });
  const { items: [movie] } = await content.getMovies({ ...options, localeId: 'locale-tr' });
  assert.equal(movie.title, 'Türkçe film'); assert.equal(movie.description, 'Türkçe açıklama');
  assert.deepEqual(movie.categories, [{ id: 'category', name: 'Aksiyon', slug: 'action' }, { id: 'fallback', name: 'Drama', slug: 'drama' }]);
  assert.deepEqual(movie.poster, { id: 'poster', url: 'https://cdn.test/poster.jpg', alt: 'Poster' });
  assert.equal(movie.releaseDate, '2026-01-01T00:00:00.000Z');
});

function controller(content) {
  const values = new Map(); const writes = [];
  const ctx = { resolve: async (tenantId, mallId, locale) => ({ tenantId, mallId, locale: locale ? { id: `locale-${locale}`, code: locale } : null }) };
  const cache = { get: async key => values.get(key), set: async (key, value, ttl) => { values.set(key, value); writes.push({ key, ttl }); } };
  return { api: new PublicController(ctx, content, cache), writes };
}

test('requested web envelope and pagination include all 101 films across pages', async () => {
  const { content } = fixture(Array.from({ length: 101 }, (_, i) => ({ ...base, id: `film-${i}` })));
  const { api } = controller(content);
  const first = await api.getMovies('tenant', 'mall', 'tr', '1', '100');
  const second = await api.getMovies('tenant', 'mall', 'tr', '2', '100');
  assert.equal(first.success, true); assert.equal(first.locale, 'tr');
  assert.deepEqual(first.tenant, { id: 'tenant', mallId: 'mall' });
  assert.deepEqual(first.pagination, { page: 1, limit: 100, total: 101, totalPages: 2 });
  assert.equal(first.data.length, 100); assert.equal(second.data.length, 1);
  assert.equal(new Set([...first.data, ...second.data].map(movie => movie.id)).size, 101);
  assert.deepEqual((await api.getMovies('tenant', 'mall', 'tr', '3', '100')).data, []);
});

test('mall is required; default/capped limits and cache vary by tenant, mall, locale, page and limit', async () => {
  const calls = [];
  const { api, writes } = controller({ getMovies: async opts => { calls.push(opts); return { items: [], total: 0 }; } });
  await assert.rejects(api.getMovies('tenant', undefined, 'tr'), /x-mall-id/);
  await api.getMovies('tenant', 'mall', 'tr');
  await api.getMovies('tenant', 'mall', 'tr', '1', '1000'); // same capped key
  assert.equal(calls.length, 1); assert.equal(calls[0].limit, 100);
  for (const args of [['other','mall','tr'], ['tenant','other','tr'], ['tenant','mall','en'], ['tenant','mall','tr','2'], ['tenant','mall','tr','1','10']]) await api.getMovies(...args);
  assert.equal(calls.length, 6); assert.equal(new Set(writes.map(row => row.key)).size, 6);
  assert.ok(writes.every(row => row.ttl === 120));
});

test('generated OpenAPI documents required context, pagination and movie array envelope', () => {
  const doc = require('../openapi/openapi.json');
  const operation = doc.paths['/public/movies'].get;
  const parameters = operation.parameters;
  for (const name of ['x-tenant-id', 'x-mall-id']) {
    const matches = parameters.filter(param => param.in === 'header' && param.name === name);
    assert.equal(matches.length, 1); assert.equal(matches[0].required, true);
  }
  for (const [name, expected] of [['page', 1], ['limit', 100]]) {
    const query = parameters.find(param => param.in === 'query' && param.name === name);
    assert.equal(query.schema.default, expected);
  }
  assert.equal(parameters.find(param => param.name === 'limit').schema.maximum, 100);
  assert.ok(parameters.some(param => param.in === 'query' && param.name === 'locale'));
  assert.ok(operation.security.some(security => 'apiKey' in security));
  const envelope = doc.components.schemas.PublicMoviesPaginatedDto;
  assert.equal(envelope.properties.data.type, 'array');
  assert.equal(envelope.properties.data.items.$ref, '#/components/schemas/PublicMovieDto');
  assert.ok(doc.components.schemas.PublicPaginationMetaDto.properties.totalPages);
});
