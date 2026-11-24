const {test}=require('node:test');
const assert=require('node:assert/strict');
const {CmsPublicClient}=require('../dist/client');
test('tracking posts real click event with scope headers and keepalive, without adding scope to body',async()=>{
  let sent;
  const client=new CmsPublicClient({baseUrl:'https://cms.example.test',tenantId:'tenant',mallId:'mall',apiKey:'test-key',fetchImpl:async(url,options)=>{sent={url,options};return{ok:true,json:async()=>({success:true,data:{accepted:true}})};}});
  const input={entityType:'STORE',entityId:'store-id',eventType:'STORE_CLICK',path:'/stores/adidas',clientEventId:'1aecc5b6-cba8-4995-8270-a1da296cb129'};
  assert.equal((await client.trackAnalytics(input)).data.accepted,true);
  assert.equal(new URL(sent.url).pathname,'/public/analytics/track');assert.equal(sent.options.method,'POST');assert.equal(sent.options.keepalive,true);
  assert.equal(sent.options.headers['x-api-key'],'test-key');assert.equal(sent.options.headers['x-tenant-id'],'tenant');assert.equal(sent.options.headers['x-mall-id'],'mall');
  assert.deepEqual(JSON.parse(sent.options.body),input);
});
test('tracking requires mall context; callers can catch rejected requests without blocking navigation',async()=>{
  const client=new CmsPublicClient({baseUrl:'https://cms.example.test',tenantId:'tenant',apiKey:'test-key',fetchImpl:async()=>{throw Error('should not send');}});
  assert.throws(()=>client.trackAnalytics({entityType:'PAGE',eventType:'PAGE_VIEW',path:'/'}),/mallId/);
});
