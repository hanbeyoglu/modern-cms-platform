const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validate } = require('class-validator');
const { Prisma } = require('@prisma/client');
const { AnalyticsService } = require('../dist/analytics/analytics.service');
const { TrackAnalyticsDto } = require('../dist/analytics/dto/track-analytics.dto');
const { AnalyticsRateLimitGuard } = require('../dist/analytics/analytics-rate-limit.guard');
const q = { dateFrom:'2026-11-01T00:00:00Z',dateTo:'2026-11-03T23:59:59Z',metric:'clicks',limit:10 };
function matches(row,where) {
  return Object.entries(where??{}).every(([key,value])=>{
    if(key==='OR')return value.some(w=>matches(row,w));
    if(value&&typeof value==='object') {
      if('in' in value)return value.in.includes(row[key]);
      if('not' in value)return row[key]!==value.not;
      if('gte' in value||'lte' in value)return (!value.gte||row[key]>=value.gte)&&(!value.lte||row[key]<=value.lte);
    }
    return row[key]===value;
  });
}
function fixture() {
  const events=[];const writes=[];const queries=[];
  const stores=[{id:'store-a',tenantId:'t',mallId:'m',deletedAt:null,detailTitle:null,globalStore:{name:'Adidas'}},{id:'store-b',tenantId:'t',mallId:'m',deletedAt:null,detailTitle:'Zara Yerel',globalStore:{name:'Zara'}},{id:'hidden',tenantId:'t',mallId:'other',deletedAt:null,globalStore:{name:'SECRET'}}];
  let enabled=true;
  const prisma={
    tenantCapability:{findFirst:async()=>enabled?{id:'cap'}:null},
    mallStore:{findMany:async({where})=>stores.filter(row=>matches(row,where))},
    event:{findMany:async({where})=>[{id:'event-a',tenantId:'t',mallId:null,deletedAt:null,title:'Konser'}].filter(row=>matches(row,where))},
    campaign:{findMany:async({where})=>[{id:'campaign-a',tenantId:'t',mallId:'m',deletedAt:null,title:'Yaz Fırsatı'}].filter(row=>matches(row,where))},cinema:{findMany:async({where})=>[{id:'cinema-a',tenantId:'t',mallId:'m',deletedAt:null,name:'AVM Sineması'}].filter(row=>matches(row,where))},movie:{findMany:async({where})=>[{id:'movie-a',tenantId:'t',deletedAt:null,title:'Örnek Film'}].filter(row=>matches(row,where))},slider:{findMany:async()=>[]},movieSession:{findMany:async()=>[]},
    tenantUser:{findFirst:async()=>({role:{code:'MALL_MANAGER'},mallAccess:[{mallId:'m'}]})},
    analyticsEvent:{
      create:async({data})=>{if(data.clientEventId&&events.some(row=>row.clientEventId===data.clientEventId&&row.mallId===data.mallId&&row.tenantId===data.tenantId))throw new Prisma.PrismaClientKnownRequestError('duplicate',{code:'P2002',clientVersion:'test'});const row={id:`id-${events.length}`,createdAt:new Date('2026-11-02T12:00:00Z'),...data};events.push(row);writes.push(data);return row;},
      findUnique:async({where})=>events.find(row=>matches(row,where.tenantId_mallId_clientEventId)),
      groupBy:async({where,by,take})=>{queries.push(where);const groups=new Map();for(const row of events.filter(row=>matches(row,where))){const key=JSON.stringify(by.map(field=>row[field]??null));if(!groups.has(key))groups.set(key,{...Object.fromEntries(by.map(field=>[field,row[field]??null])),_count:{_all:0}});groups.get(key)._count._all++;}return [...groups.values()].sort((a,b)=>b._count._all-a._count._all).slice(0,take??Infinity);},
    },
    $queryRaw:async sql=>{queries.push(sql);return [];},
  };
  const access={assertTenantAccess:async()=>{},assertMallAccess:async(_u,tenant,mall)=>{if(tenant!=='t'||mall!=='m')throw Object.assign(new Error('forbidden'),{status:403});}};
  const context={resolve:async(tenant,mall)=>{if(tenant!=='t'||mall!=='m')throw Object.assign(new Error('invalid mall'),{status:404});return{tenantId:tenant,mallId:mall,locale:{code:'tr'}};}};
  const service=new AnalyticsService(prisma,access,{get:()=> 'test-salt'},context);
  const req={tenantId:'t',ip:'127.0.0.1',headers:{},header:key=>({'x-tenant-id':'t','x-mall-id':'m'})[key]};
  return{service,events,writes,queries,req,disable:()=>{enabled=false;}};
}
test('ingestion validates key scope, entity ownership and event/entity combination',async()=>{
  const f=fixture();
  const payload={entityType:'STORE',entityId:'store-a',eventType:'STORE_CLICK',path:'/stores/adidas?token=secret#x',metadataJson:{label:'Untrusted title',source:'home',email:'private@example.com'}};
  await f.service.track(f.req,payload);
  assert.equal(f.writes[0].path,'/stores/adidas');assert.equal(f.writes[0].userAgent,null);assert.equal(f.writes[0].referrer,null);assert.equal(f.writes[0].metadataJson.email,undefined);
  for(const dto of [{...payload,entityId:'hidden'},{...payload,eventType:'EVENT_CLICK'},{entityType:'PAGE',eventType:'PAGE_VIEW',path:'https://evil.example/'}])await assert.rejects(f.service.track(f.req,dto));
  await assert.rejects(f.service.track({...f.req,header:key=>key==='x-tenant-id'?'other':'m'},payload),{status:403});
  await assert.rejects(f.service.track({...f.req,header:key=>key==='x-tenant-id'?'t':'other'},payload),{status:404});
  await assert.rejects(f.service.track({...f.req,header:key=>key==='x-tenant-id'?'t':undefined},payload),{status:400});
  f.disable();await assert.rejects(f.service.track(f.req,payload),{status:403});assert.equal(f.events.length,1);
});
test('same client event retry counts once; actual subsequent click counts separately',async()=>{
  const f=fixture();const input={entityType:'STORE',entityId:'store-a',eventType:'STORE_CLICK',clientEventId:'1aecc5b6-cba8-4995-8270-a1da296cb129'};
  const a=await f.service.track(f.req,input);const b=await f.service.track(f.req,input);assert.equal(a.id,b.id);assert.equal(f.events.length,1);
  await f.service.track(f.req,{...input,clientEventId:'f6dba3ec-ab5a-443a-9090-b2613ac4281a'});assert.equal(f.events.length,2);
});
test('ranking uses real scoped names, counts clicks apart from views, filters range and limits results',async()=>{
  const f=fixture();for(const id of ['store-a','store-a','store-b'])await f.service.track(f.req,{entityType:'STORE',entityId:id,eventType:'STORE_CLICK',path:`/stores/${id}`});
  await f.service.track(f.req,{entityType:'STORE',entityId:'store-b',eventType:'STORE_VIEW'});
  f.events.push({tenantId:'other',mallId:'m',entityType:'STORE',entityId:'hidden',eventType:'STORE_CLICK',createdAt:new Date('2026-11-02')});
  f.events.push({tenantId:'t',mallId:'m',entityType:'STORE',entityId:'hidden',eventType:'STORE_CLICK',createdAt:new Date('2026-11-02')});
  f.events.push({tenantId:'t',mallId:'m',entityType:'STORE',entityId:'store-a',eventType:'STORE_CLICK',createdAt:new Date('2020-01-01')});
  const top=await f.service.topContent({isSuperAdmin:true},'t','m',{...q,limit:2});assert.equal(top.length,2);assert.equal(top[0].name,'Adidas');assert.equal(top[0].count,2);assert.equal(top[1].name,'Zara Yerel');
  const all=await f.service.topContent({isSuperAdmin:true},'t','m',q);assert.ok(!all.some(row=>row.name==='SECRET'));
  const summary=await f.service.summary({isSuperAdmin:true},'t','m',{...q,metric:'all'});assert.equal(summary.storeViews,1);assert.equal(summary.storeClicks,4);assert.equal(summary.totalClicks,4);
  await assert.rejects(f.service.topContent({isSuperAdmin:false},'t','other',q),{status:403});
});
test('restricted user without mall header only queries assigned malls; empty results and UTC zero days are safe',async()=>{
  const f=fixture();assert.deepEqual(await f.service.topContent({isSuperAdmin:false,id:'user'},'t',undefined,q),[]);
  assert.deepEqual(f.queries[0].mallId,{in:['m']});
  const days=await f.service.timeseries({isSuperAdmin:true},'t','m',q);assert.equal(days.length,3);assert.deepEqual(days[0],{date:'2026-11-01',byEventType:{}});
  const sql=f.queries.at(-1);assert.ok(sql.values.includes('t'));assert.ok(sql.values.includes('m'));assert.ok(sql.values.includes('STORE_CLICK'));
  await assert.rejects(f.service.summary({isSuperAdmin:true},'t','m',{...q,dateTo:'2025-01-01'}),{status:400});
  await assert.rejects(f.service.summary({isSuperAdmin:true},'t','m',{...q,dateTo:'2030-01-01'}),{status:400});
});
test('DTO rejects client-controlled scope and IP limiter rejects excess and Redis failure',async()=>{
  const dto=Object.assign(new TrackAnalyticsDto(),{entityType:'STORE',eventType:'STORE_CLICK',entityId:'store-a',tenantId:'forged'});
  assert.ok((await validate(dto,{whitelist:true,forbidNonWhitelisted:true})).some(e=>e.property==='tenantId'));
  let hits=0;const keys=[];const guard=new AnalyticsRateLimitGuard({increment:async key=>{keys.push(key);return ++hits;}});
  const context={switchToHttp:()=>({getRequest:()=>({tenantId:'t',mallId:'m',ip:'127.0.0.1',headers:{'x-forwarded-for':'spoofed'}}),getResponse:()=>({setHeader:()=>{}})})};
  for(let n=0;n<120;n++)await guard.canActivate(context);
  await assert.rejects(guard.canActivate(context),{status:429});assert.equal(new Set(keys).size,1);assert.ok(!keys[0].includes('127.0.0.1'));
  await assert.rejects(new AnalyticsRateLimitGuard({increment:async()=>0}).canActivate(context),{status:503});
});

test('event, campaign, cinema, movie and navigation clicks are reported with separate real labels',async()=>{
  const f=fixture();
  for(const [entityType,eventType,entityId] of [['EVENT','EVENT_CLICK','event-a'],['CAMPAIGN','CAMPAIGN_CLICK','campaign-a'],['CINEMA','CINEMA_CLICK','cinema-a'],['MOVIE','MOVIE_CLICK','movie-a']]) {
    await f.service.track(f.req,{entityType,eventType,entityId,path:'/content'});
  }
  await f.service.track(f.req,{entityType:'CUSTOM',eventType:'LINK_CLICK',path:'/contact?email=private#x',metadataJson:{source:'footer'}});
  const top=await f.service.topContent({isSuperAdmin:true},'t','m',q);
  assert.ok(top.some(row=>row.name==='Konser'));
  assert.ok(top.some(row=>row.name==='Yaz Fırsatı'));
  assert.ok(top.some(row=>row.name==='AVM Sineması'));
  assert.ok(top.some(row=>row.name==='Örnek Film'));
  const summary=await f.service.summary({isSuperAdmin:true},'t','m',q);
  assert.equal(summary.eventClicks,1);assert.equal(summary.campaignClicks,1);assert.equal(summary.cinemaClicks,1);assert.equal(summary.movieClicks,1);assert.equal(summary.totalClicks,5);
  const paths=await f.service.topPaths({isSuperAdmin:true},'t','m',{...q,entityType:'CUSTOM'});
  assert.deepEqual(paths,[{path:'/contact',eventType:'LINK_CLICK',count:1}]);
});
