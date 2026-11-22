const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { DashboardService, campaignEventMallScope } = require('../dist/dashboard/dashboard.service');
const { CampaignsService } = require('../dist/campaigns/campaigns.service');
const { ListCampaignsDto } = require('../dist/campaigns/dto/list-campaigns.dto');

function recordingPrisma() {
  const calls = {};
  const model = (name) => ({
    count: async (args) => { (calls[name] ??= []).push(['count', args]); return 0; },
    findMany: async (args) => { (calls[name] ??= []).push(['findMany', args]); return []; },
  });
  const prisma = {};
  for (const n of ['mallStore', 'campaign', 'event', 'slider', 'popup', 'mediaAsset', 'service', 'page']) prisma[n] = model(n);
  return { prisma, calls };
}

test('campaign/event AVM scope includes tenant-wide content, like the public API', () => {
  assert.deepEqual(campaignEventMallScope('m1'), { OR: [{ mallId: 'm1' }, { mallId: null }] });
  assert.deepEqual(campaignEventMallScope(undefined), {});
});

test('dashboard counts campaigns/events with the public AVM rule; sliders/popups stay AVM-only', async () => {
  const { prisma, calls } = recordingPrisma();
  await new DashboardService(prisma).summary('t1', 'm1');
  const liveCampaigns = calls.campaign.find(([op]) => op === 'count')[1].where;
  assert.equal(liveCampaigns.status, 'PUBLISHED');
  assert.deepEqual(liveCampaigns.AND[0], { OR: [{ mallId: 'm1' }, { mallId: null }] });
  assert.equal(liveCampaigns.AND.length, 3, 'scope + publish start + publish end');
  assert.equal('mallId' in liveCampaigns, false);
  const upcomingEvents = calls.event.find(([op]) => op === 'count')[1].where;
  assert.deepEqual(upcomingEvents.OR, [{ mallId: 'm1' }, { mallId: null }]);
  for (const [, args] of calls.campaign.filter(([op]) => op === 'findMany')) {
    assert.deepEqual(args.where.OR, [{ mallId: 'm1' }, { mallId: null }]);
  }
  const sliders = calls.slider.find(([op]) => op === 'count')[1].where;
  assert.equal(sliders.mallId, 'm1');
});

test('visibleNow=true limits the campaign list to what visitors see now', async () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const dto = await pipe.transform({ visibleNow: 'true', endFrom: '2030-01-01T00:00:00.000Z' }, { type: 'query', metatype: ListCampaignsDto });
  await assert.rejects(pipe.transform({ visibleNow: 'yes' }, { type: 'query', metatype: ListCampaignsDto }));
  const service = Object.create(CampaignsService.prototype);
  const where = service.buildListWhere('t1', 'm1', dto);
  assert.equal(where.status, 'PUBLISHED');
  assert.equal(where.AND.length, 2);
  assert.deepEqual(where.OR, [{ mallId: 'm1' }, { mallId: null }]);
  assert.ok(where.campaignEndAt.gte instanceof Date);
  const plain = service.buildListWhere('t1', 'm1', await pipe.transform({}, { type: 'query', metatype: ListCampaignsDto }));
  assert.equal(plain.AND, undefined);
  assert.deepEqual(plain.status, { not: 'ARCHIVED' });
});
