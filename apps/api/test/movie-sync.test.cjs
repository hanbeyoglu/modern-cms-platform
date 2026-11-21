const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runMovieSync, importMovieFromProvider } = require('@modern-cms/movie-providers');

function setup(initial = []) {
  const rows = initial.map(row => ({ tenantId: 'tenant', status: 'ACTIVE', provider: 'TMDB', deletedAt: null,
    manualStatusOverride: false, listingStatus: 'OTHER', slug: `movie-${row.tmdbId}`, ...row }));
  const fetched = [];
  const matches = (row, where) => row.tenantId === where.tenantId && (!where.provider || row.provider === where.provider);
  const prisma = {
    movieSyncLog: { create: async () => ({ id: 'log' }), update: async () => ({}) },
    locale: { findMany: async () => [] },
    movie: {
      findFirst: async ({ where }) => rows.find(row => row.tenantId === where.tenantId &&
        (where.tmdbId !== undefined ? row.tmdbId === where.tmdbId : row.slug === where.slug)),
      findMany: async ({ where }) => rows.filter(row => matches(row, where) &&
        (where.deletedAt?.not === null ? row.deletedAt != null : row.deletedAt == null)),
      create: async ({ data }) => {
        const row = { id: `film-${data.tmdbId}`, deletedAt: null, ...data }; rows.push(row); return row;
      },
      update: async ({ where, data }) => { const row = rows.find(row => row.id === where.id); Object.assign(row, data); return row; },
      updateMany: async ({ where, data }) => {
        const selected = rows.filter(row => matches(row, where) && row.deletedAt == null && (!('manualStatusOverride' in where) || row.manualStatusOverride === where.manualStatusOverride) && where.id.in.includes(row.id));
        selected.forEach(row => Object.assign(row, data)); return { count: selected.length };
      },
    },
  };
  const provider = {
    getNowPlaying: async () => ({ page: 1, totalPages: 1, results: [{ id: 1 }, { id: 3 }, { id: 4 }] }),
    getUpcoming: async () => ({ page: 1, totalPages: 1, results: [{ id: 2 }, { id: 3 }] }),
    getPopular: async () => { throw new Error('Popular must not be synchronized'); },
    getMovie: async id => { fetched.push(id); return { id, title: `Film ${id}`, genreNames: [] }; },
  };
  return { rows, fetched, prisma, provider, deps: { prisma, provider, tenantId: 'tenant', systemUserId: 'user' } };
}

test('sync stores regional now-playing/upcoming classifications, prioritizes now-playing and preserves editorial controls', async () => {
  const { deps, rows, fetched } = setup([
    { id: 'passive', tmdbId: 1, status: 'PASSIVE' },
    { id: 'deleted', tmdbId: 4, deletedAt: new Date() },
    { id: 'old', tmdbId: 5, listingStatus: 'NOW_PLAYING' },
    { id: 'manual', tmdbId: null, provider: 'MANUAL', listingStatus: 'UPCOMING' },
    { id: 'foreign', tmdbId: 6, tenantId: 'other', listingStatus: 'NOW_PLAYING' },
  ]);
  const result = await runMovieSync(deps);
  assert.equal(result.status, 'SUCCESS');
  assert.equal(rows.find(row => row.tmdbId === 1).listingStatus, 'NOW_PLAYING');
  assert.equal(rows.find(row => row.tmdbId === 1).status, 'PASSIVE');
  assert.equal(rows.find(row => row.tmdbId === 2).listingStatus, 'UPCOMING');
  assert.equal(rows.find(row => row.tmdbId === 3).listingStatus, 'NOW_PLAYING');
  assert.ok(rows.find(row => row.tmdbId === 4).deletedAt);
  assert.ok(!fetched.includes(4));
  assert.equal(rows.find(row => row.id === 'old').listingStatus, 'OTHER');
  assert.equal(rows.find(row => row.id === 'old').status, 'ARCHIVED');
  assert.equal(rows.find(row => row.id === 'manual').listingStatus, 'UPCOMING');
  assert.equal(rows.find(row => row.id === 'foreign').listingStatus, 'NOW_PLAYING');
});

test('all feed pages are imported, including pages after the former five-page cap', async () => {
  const { deps, provider, rows } = setup();
  const pages = [];
  provider.getNowPlaying = async page => { pages.push(page); return { page, totalPages: 6, results: [{ id: page + 10 }] }; };
  provider.getUpcoming = async () => ({ page: 1, totalPages: 1, results: [] });
  assert.equal((await runMovieSync(deps)).status, 'SUCCESS');
  assert.deepEqual(pages, [1, 2, 3, 4, 5, 6]);
  assert.equal(rows.length, 6);
});

test('failed feed fetch does not erase existing catalogue classifications', async () => {
  const { deps, provider, rows } = setup([{ id: 'existing', tmdbId: 1, listingStatus: 'NOW_PLAYING' }]);
  provider.getUpcoming = async () => { throw new Error('TMDB unavailable'); };
  assert.equal((await runMovieSync(deps)).status, 'FAILED');
  assert.equal(rows[0].listingStatus, 'NOW_PLAYING');
});

test('explicit import can restore a deleted TMDB movie, but automatic import cannot', async () => {
  const { deps, rows } = setup([{ id: 'deleted', tmdbId: 4, deletedAt: new Date() }]);
  const input = { ...deps, userId: 'user' };
  const skipped = await importMovieFromProvider({ ...input, skipDeleted: true }, 4);
  assert.equal(skipped.skipped, true);
  assert.ok(rows[0].deletedAt);
  const restored = await importMovieFromProvider(input, 4);
  assert.equal(restored.movieId, 'deleted');
  assert.equal(rows[0].deletedAt, null);
  assert.equal(rows.length, 1);
});

test('automatic archive reopens when movie returns to TMDB, manual archive/publication stays unchanged', async () => {
  const { deps, rows } = setup([
    { id: 'returning', tmdbId: 1, status: 'ARCHIVED' },
    { id: 'editor-archived', tmdbId: 2, status: 'ARCHIVED', manualStatusOverride: true },
    { id: 'editor-live', tmdbId: 7, status: 'ACTIVE', listingStatus: 'NOW_PLAYING', manualStatusOverride: true },
  ]);
  await runMovieSync(deps);
  assert.equal(rows.find(row => row.id === 'returning').status, 'ACTIVE');
  assert.equal(rows.find(row => row.id === 'returning').listingStatus, 'NOW_PLAYING');
  assert.equal(rows.find(row => row.id === 'editor-archived').status, 'ARCHIVED');
  assert.equal(rows.find(row => row.id === 'editor-archived').listingStatus, 'OTHER');
  assert.equal(rows.find(row => row.id === 'editor-live').status, 'ACTIVE');
  assert.equal(rows.find(row => row.id === 'editor-live').listingStatus, 'NOW_PLAYING');
});
