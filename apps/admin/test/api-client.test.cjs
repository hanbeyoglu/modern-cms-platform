const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function client(fetch) {
  const events = [];
  const source = fs.readFileSync(require.resolve('../src/lib/api/client.ts'), 'utf8')
    .replace('import.meta.env.VITE_API_URL', JSON.stringify('http://cms.test'));
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = {
    exports: {}, fetch, FormData, CustomEvent,
    window: { dispatchEvent: (event) => events.push(event.type) },
  };
  vm.runInNewContext(compiled, context);
  return { ...context.exports, events };
}
const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
const denied = () => new Response(JSON.stringify({ error: { message: 'Geçersiz kimlik bilgileri' } }), { status: 401 });

test('requests include the selected context and do not reuse a mall across tenants', async () => {
  const requests = [];
  const api = client(async (_url, options) => { requests.push(options.headers); return ok(); });
  api.setApiContext('tenant-a', 'mall-a');
  await api.request('/users', { token: 'access' });
  await api.request('/events', { token: 'access', tenantId: 'tenant-b' });
  assert.equal(requests[0]['x-tenant-id'], 'tenant-a');
  assert.equal(requests[0]['x-mall-id'], 'mall-a');
  assert.equal(requests[1]['x-tenant-id'], 'tenant-b');
  assert.equal(requests[1]['x-mall-id'], undefined);
});

test('a rejected login displays the API error without ending an existing session', async () => {
  const api = client(async () => denied());
  await assert.rejects(api.request('/auth/login', { method: 'POST' }), /Geçersiz kimlik bilgileri/);
  assert.equal(api.events.length, 0);
});

test('concurrent expired requests share one refresh and retry with the new token', async () => {
  let refreshes = 0;
  const api = client(async (_url, options) => options.headers.Authorization === 'Bearer new' ? ok() : denied());
  api.setSessionRefresher(async () => { refreshes++; await new Promise((r) => setTimeout(r, 5)); return 'new'; });
  await Promise.all([api.request('/users', { token: 'old' }), api.request('/roles', { token: 'old' })]);
  assert.equal(refreshes, 1);
  assert.equal(api.events.length, 0);
});

test('failed refresh ends the session without retrying indefinitely', async () => {
  let refreshes = 0;
  const api = client(async () => denied());
  api.setSessionRefresher(async () => { refreshes++; throw new Error('revoked'); });
  await assert.rejects(api.request('/users', { token: 'old' }), /Oturum süresi doldu/);
  assert.equal(refreshes, 1);
  assert.equal(api.events.length, 1);
});

test('successful empty reorder responses do not attempt JSON parsing', async () => {
  for (const response of [new Response(null, { status: 204 }), new Response('', { status: 200 }), new Response('  ', { status: 200 })]) {
    const api = client(async () => response);
    assert.equal(await api.request('/sliders/group/items/reorder', { method: 'PATCH', token: 'access' }), undefined);
  }
});

test('successful JSON responses still return their parsed payload', async () => {
  const api = client(async () => ok());
  assert.equal((await api.request('/sliders', { token: 'access' })).ok, true);
});
