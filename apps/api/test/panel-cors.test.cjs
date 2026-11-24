const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PublicCorsService } = require('../dist/common/public-cors.service');
const { buildCorsOptions } = require('../dist/common/cors-options');
const origin = 'https://metrogarden.hanbeyoglu.com';
function fixture() {
  const rows = [{id:'domain',domain:'metrogarden.hanbeyoglu.com',tenant:{status:'ACTIVE',deletedAt:null}}];
  let fail = false; let calls = 0;
  const prisma = {allowedDomain:{findFirst:async({where})=>{
    calls++;
    if(fail)throw Error('offline');
    assert.deepEqual(where.tenant,{status:'ACTIVE',deletedAt:null});
    return rows.find(row=>row.domain===where.domain&&row.tenant.status==='ACTIVE'&&!row.tenant.deletedAt)??null;
  }}};
  const service = new PublicCorsService(prisma);
  const options = (url, requestOrigin=origin, env='localhost,https://modern-cms.hanbeyoglu.com') => new Promise((resolve,reject)=>{
    service.createOptions(env)({headers:requestOrigin?{origin:requestOrigin}:{},originalUrl:url},(error,result)=>error?reject(error):resolve(result));
  });
  return { rows, options, prisma, setFail:()=>{fail=true;}, calls:()=>calls };
}
test('panel domain applies to public routes immediately; removal and disabled tenant revoke it',async()=>{
  const f=fixture();
  assert.equal((await f.options('/public/site-config?locale=tr')).origin,origin);
  f.rows[0].tenant.status='SUSPENDED';
  assert.equal((await f.options('/public/events')).origin,false);
  f.rows[0].tenant.status='ACTIVE';
  f.rows.pop();
  assert.equal((await f.options('/public/site-config')).origin,false);
  f.rows.push({id:'new',domain:'metrogarden.hanbeyoglu.com',tenant:{status:'ACTIVE',deletedAt:null}});
  assert.equal((await f.options('/public/site-config')).origin,origin);
});
test('dynamic domains cannot enable admin/login CORS; hostname lookalikes and invalid origins fail closed',async()=>{
  const f=fixture();
  for(const path of ['/auth/login','/events','/publicity','/public-api','/developer-api/domains']) assert.equal((await f.options(path)).origin,false);
  for(const value of ['https://metrogarden.hanbeyoglu.com.evil.example','https://other.hanbeyoglu.com','null','file://metrogarden.hanbeyoglu.com','https://metrogarden.hanbeyoglu.com/','https://user:pass@metrogarden.hanbeyoglu.com']) assert.equal((await f.options('/public/events',value)).origin,false);
  assert.equal((await f.options('/public/events',null)).origin,false);
  assert.equal(buildCorsOptions('').origin,false);
});
test('environment origins and localhost rules remain available on all routes, even during DB outage',async()=>{
  const f=fixture();f.setFail();
  assert.equal((await f.options('/auth/login','https://modern-cms.hanbeyoglu.com')).origin,'https://modern-cms.hanbeyoglu.com');
  assert.equal((await f.options('/public/events','http://localhost:5174')).origin,'http://localhost:5174');
  assert.equal(f.calls(),0);
  assert.equal((await f.options('/public/events')).origin,false);
});
test('real Nest preflight and 401 use panel domain without API key on OPTIONS',async()=>{
  require('reflect-metadata');
  const {Controller,Get,Module,UnauthorizedException}=require('@nestjs/common');
  const {NestFactory}=require('@nestjs/core');
  const f=fixture();let calls=0;
  class Probe { get(){calls++;throw new UnauthorizedException();} }
  Controller('public')(Probe);
  Get('site-config')(Probe.prototype,'get',Object.getOwnPropertyDescriptor(Probe.prototype,'get'));
  class ProbeModule{}
  Module({controllers:[Probe]})(ProbeModule);
  const app=await NestFactory.create(ProbeModule,{logger:false});
  app.enableCors(new PublicCorsService(f.prisma).createOptions('https://modern-cms.hanbeyoglu.com'));
  try {
    await app.listen(0,'127.0.0.1');const url=`${await app.getUrl()}/public/site-config?locale=tr`;
    const preflight=await fetch(url,{method:'OPTIONS',headers:{origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'accept,x-api-key,x-tenant-id,x-mall-id'}});
    assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);assert.equal(calls,0);
    const get=await fetch(url,{headers:{origin}});
    assert.equal(get.status,401);assert.equal(get.headers.get('access-control-allow-origin'),origin);await get.arrayBuffer();
  }finally{await app.close();}
});
test('API-key tenant domain guard remains separate and panel removals bypass old domain cache',async()=>{
  const {PublicApiKeyGuard}=require('../dist/public/guards/public-api-key.guard');
  let domains=['other.example'];
  const developer={validateApiKey:async()=>({tenantId:'other-tenant',keyId:'key'}),getAllowedDomains:async tenant=>{assert.equal(tenant,'other-tenant');return domains;},logRequest:async()=>{}};
  const cache={get:async()=>['metrogarden.hanbeyoglu.com']};
  const guard=new PublicApiKeyGuard(developer,cache);
  const req={headers:{'x-api-key':'test-only',origin},socket:{},method:'GET',path:'/public/site-config'};
  await assert.rejects(guard.canActivate({switchToHttp:()=>({getRequest:()=>req,getResponse:()=>({})})}),{status:403});
  assert.deepEqual(await guard.getAllowedDomains('other-tenant'),['other.example']);
  domains=['replacement.example'];
  assert.deepEqual(await guard.getAllowedDomains('other-tenant'),['replacement.example']);
});
