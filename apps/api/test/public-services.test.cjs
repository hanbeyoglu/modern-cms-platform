const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PublicContentService } = require('../dist/public/public-content.service');

const hours = {
  monday: { open: true, from: '09:00', to: '21:00' },
  tuesday: { open: true, from: '09:00', to: '21:00' },
  wednesday: { open: false },
  thursday: { open: true, from: '09:00', to: '21:00' },
  friday: { open: true, from: '09:00', to: '22:00' },
  saturday: { open: true, from: '10:00', to: '22:00' },
  sunday: { open: false },
};

const base = {
  tenantId: 'tenant',
  mallId: 'mall',
  name: 'Vale',
  description: 'Vale hizmeti',
  iconMedia: null,
  coverMedia: null,
  iconMediaWidthOverride: null,
  iconMediaHeightOverride: null,
  coverMediaWidthOverride: null,
  coverMediaHeightOverride: null,
  category: 'Otopark',
  floor: 'P1',
  unitNo: null,
  phone: null,
  email: null,
  websiteUrl: null,
  locationLabel: 'Batı kapısı',
  latitude: null,
  longitude: null,
  workingHoursJson: hours,
  searchTags: ['vale'],
  isSoon: false,
  sortOrder: 0,
  status: 'ACTIVE',
  deletedAt: null,
};

function fixture(rows, translations = {}) {
  const calls = [];
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'AND') return value.every((part) => matches(row, part));
      if (key === 'OR') return value.some((part) => matches(row, part));
      if (value && typeof value === 'object') {
        if ('contains' in value) {
          const hay = String(row[key] ?? '').toLowerCase();
          return hay.includes(String(value.contains).toLowerCase());
        }
        throw new Error(`Unsupported predicate: ${key}`);
      }
      return row[key] === value;
    });
  }
  const prisma = {
    service: {
      findMany: async (args) => {
        calls.push({ op: 'findMany', ...args });
        return rows.filter((row) => matches(row, args.where)).slice(args.skip, args.skip + args.take);
      },
      count: async ({ where }) => rows.filter((row) => matches(row, where)).length,
      findFirst: async (args) => {
        calls.push({ op: 'findFirst', ...args });
        return rows.find((row) => matches(row, args.where)) ?? null;
      },
    },
  };
  const resolver = {
    getTranslationsForEntities: async (tenant, locale, type, ids) => {
      assert.equal(tenant, 'tenant');
      assert.equal(locale, 'locale-tr');
      return Object.fromEntries(
        ids.filter((id) => translations[type]?.[id]).map((id) => [id, translations[type][id]]),
      );
    },
  };
  return { content: new PublicContentService(prisma, resolver), calls };
}

const listOpts = { tenantId: 'tenant', mallId: 'mall', page: 1, limit: 50 };

test('public services list returns active mall services with workingHours', async () => {
  const { content, calls } = fixture([
    { ...base, id: 'active', name: 'Vale' },
    { ...base, id: 'inactive', name: 'ATM', status: 'INACTIVE' },
    { ...base, id: 'deleted', name: 'WC', deletedAt: new Date() },
    { ...base, id: 'other-mall', name: 'Danışma', mallId: 'other' },
    { ...base, id: 'no-hours', name: 'Bebek Odası', workingHoursJson: null },
  ]);

  const result = await content.getLocationServices(listOpts);
  assert.deepEqual(
    result.items.map((s) => s.id).sort(),
    ['active', 'no-hours'],
  );
  assert.equal(result.total, 2);
  assert.deepEqual(result.items.find((s) => s.id === 'active').workingHours, hours);
  assert.equal(result.items.find((s) => s.id === 'no-hours').workingHours, null);
  assert.equal(calls[0].op, 'findMany');
  assert.equal(calls[0].where.tenantId, 'tenant');
  assert.equal(calls[0].where.mallId, 'mall');
  assert.equal(calls[0].where.status, 'ACTIVE');
  assert.equal(calls[0].where.deletedAt, null);
});

test('public service detail scopes by mall and excludes inactive/deleted', async () => {
  const { content } = fixture([
    { ...base, id: 'active', workingHoursJson: hours },
    { ...base, id: 'inactive', status: 'INACTIVE' },
    { ...base, id: 'other-mall', mallId: 'other' },
  ]);

  const ok = await content.getLocationServiceById({
    tenantId: 'tenant',
    mallId: 'mall',
    id: 'active',
  });
  assert.equal(ok.id, 'active');
  assert.deepEqual(ok.workingHours, hours);

  assert.equal(
    await content.getLocationServiceById({ tenantId: 'tenant', mallId: 'mall', id: 'inactive' }),
    null,
  );
  assert.equal(
    await content.getLocationServiceById({ tenantId: 'tenant', mallId: 'mall', id: 'other-mall' }),
    null,
  );
});

test('empty public services list keeps total 0 when no active rows match', async () => {
  const { content } = fixture([
    { ...base, id: 'inactive', status: 'INACTIVE' },
    { ...base, id: 'deleted', deletedAt: new Date() },
  ]);
  const result = await content.getLocationServices(listOpts);
  assert.deepEqual(result.items, []);
  assert.equal(result.total, 0);
});
