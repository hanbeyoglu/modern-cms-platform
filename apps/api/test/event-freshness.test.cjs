const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PublicController } = require('../dist/public/public.controller');
const { PublicContentService } = require('../dist/public/public-content.service');
const { TranslationsService } = require('../dist/translations/translations.service');

test('event list/detail bypass cache and prevent HTTP caching', async () => {
  const { HEADERS_METADATA } = require('@nestjs/common/constants');
  let description = 'Before';
  const ctx = { resolve: async () => ({tenantId:'t',mallId:'m',locale:{id:'tr',code:'tr'},defaultLocale:{id:'tr',code:'tr'}}) };
  const cache = { get: async () => { throw Error('event cache must not be read'); }, set: async () => { throw Error('event cache must not be written'); } };
  const content = { getEventBySlug: async () => ({description}), getEvents: async () => ({items:[{description}],total:1}) };
  const controller = new PublicController(ctx,content,cache);
  const detail = () => controller.getEventBySlug('t','m','event','tr');
  const list = () => controller.getEvents('t','m',undefined,undefined,'1','20','tr');
  assert.equal((await detail()).data.description,'Before');
  description = 'After';
  assert.equal((await detail()).data.description,'After');
  assert.equal((await list()).data[0].description,'After');
  for (const method of ['getEvents','getEventBySlug']) {
    assert.ok(Reflect.getMetadata(HEADERS_METADATA,PublicController.prototype[method]).some(h => h.name === 'Cache-Control' && h.value === 'no-store'));
  }
});

test('updated canonical description wins over stale default translation records; other languages retain translations', async () => {
  const row = {id:'event',title:'Latest title',description:'Latest description',shortDescription:'Latest short',translations:[{localeId:'tr',title:'Old title',description:'Old default',coverImage:null},{localeId:'en',title:'English',description:'English description',coverImage:null}],sameImageForAllLocales:true,sharedCoverImage:null};
  const prisma = {event:{findFirst:async()=>row,findMany:async()=>[row],count:async()=>1},slider:{findMany:async()=>[]}};
  const resolver = {getTranslationsForEntities:async(_t,locale)=>({event:{description:locale==='tr'?'Old generic default':'Updated English'}})};
  const service = new PublicContentService(prisma,resolver);
  const opts = {tenantId:'t',mallId:'m',slug:'event',localeId:'tr',defaultLocaleId:'tr'};
  assert.equal((await service.getEventBySlug(opts)).description,'Latest description');
  assert.equal((await service.getEvents(opts)).items[0].description,'Latest description');
  row.description = null;
  assert.equal((await service.getEventBySlug(opts)).description,null);
  assert.equal((await service.getEventBySlug({...opts,localeId:'en'})).description,'Updated English');
});

test('translation upsert, update and deletion clear aggregate public cache after writes', async () => {
  const actions = [];
  const existing = {id:'translation',tenantId:'t',localeId:'en',entityType:'EVENT',entityId:'event',field:'description',value:'Before'};
  const prisma = {locale:{findFirst:async()=>({id:'en'})},localizedContent:{findUnique:async()=>existing,findFirst:async()=>existing,update:async({data})=>{actions.push('write');return {...existing,...data};},delete:async()=>actions.push('delete')}};
  const service = new TranslationsService(prisma,{logAction:async()=>{}},{touchByLocalizedEntity:async()=>{}},{invalidateTenant:async id=>actions.push(`invalidate:${id}`)});
  await service.upsert({localeId:'en',entityType:'EVENT',entityId:'event',field:'description',value:'After'},{id:'u'},'t');
  await service.update('translation',{value:'Newest'},{id:'u'},'t');
  await service.remove('translation',{id:'u'},'t');
  assert.deepEqual(actions,['write','invalidate:t','write','invalidate:t','delete','invalidate:t']);
});
