const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTs(file) {
  const source = fs.readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = {
    exports: {},
    require: (spec) => {
      if (!spec.startsWith('.')) return {};
      return loadTs(path.resolve(path.dirname(file), `${spec}.ts`));
    },
  };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

const { authReducer } = loadTs(path.resolve(__dirname, '../src/auth/auth-reducer.ts'));
const plain = (v) => JSON.parse(JSON.stringify(v));

const tenantA = { id: 'tA', name: 'A', slug: 'a', status: 'ACTIVE' };
const tenantB = { id: 'tB', name: 'B', slug: 'b', status: 'ACTIVE' };
const mall = (id) => ({ id, name: id, slug: id, status: 'LIVE' });

function restored(pendingTenantId, pendingMallId) {
  return {
    accessToken: 'tok', refreshToken: 'r', email: 'e',
    user: null, tenants: [], activeTenantId: null, malls: [], activeMallId: null,
    pendingTenantId, pendingMallId,
    profileLoading: true, mallsLoading: false, mallsError: null,
  };
}
const superAdmin = { id: 'u', isSuperAdmin: true, memberships: [] };
const member = (malls) => ({
  id: 'u2', isSuperAdmin: false,
  memberships: [{ tenantId: 'tA', malls: malls.map((id) => ({ id, name: id, slug: id })) }],
});

test('super admin: stored AVM stays pending (not active) until its mall list confirms it', () => {
  let s = authReducer(restored('tA', 'm2'), { type: 'SET_PROFILE', user: superAdmin, tenants: [tenantA, tenantB] });
  assert.equal(s.activeTenantId, 'tA');
  assert.equal(s.activeMallId, null, 'no unverified AVM in API scope');
  assert.equal(s.pendingMallId, 'm2');
  assert.equal(s.mallsLoading, true);
  s = authReducer(s, { type: 'SET_MALLS', tenantId: 'tA', malls: [mall('m1'), mall('m2')] });
  assert.equal(s.activeMallId, 'm2', 'restored after refresh');
  assert.equal(s.pendingMallId, null);
});

test('super admin: AVM no longer in the list → no AVM selected (goes to selection)', () => {
  let s = authReducer(restored('tA', 'gone'), { type: 'SET_PROFILE', user: superAdmin, tenants: [tenantA] });
  s = authReducer(s, { type: 'SET_MALLS', tenantId: 'tA', malls: [mall('m1'), mall('m2')] });
  assert.equal(s.activeMallId, null);
  assert.equal(s.pendingMallId, null);
});

test('tenant access removed → no tenant, nothing pending', () => {
  const s = authReducer(restored('tB', 'm9'), { type: 'SET_PROFILE', user: superAdmin, tenants: [tenantA] });
  assert.equal(s.activeTenantId, null);
  assert.equal(s.activeMallId, null);
  assert.equal(s.pendingTenantId, null);
  assert.equal(s.pendingMallId, null);
});

test('disabled tenant is not restored', () => {
  const s = authReducer(restored('tA', 'm1'), {
    type: 'SET_PROFILE', user: superAdmin, tenants: [{ ...tenantA, status: 'DISABLED' }, tenantB],
  });
  assert.equal(s.activeTenantId, null);
});

test('member: AVM restored only if still in membership', () => {
  const ok = authReducer(restored('tA', 'm2'), { type: 'SET_PROFILE', user: member(['m1', 'm2']), tenants: [tenantA] });
  assert.deepEqual(plain([ok.activeTenantId, ok.activeMallId, ok.mallsLoading]), ['tA', 'm2', false]);
  const revoked = authReducer(restored('tA', 'm2'), { type: 'SET_PROFILE', user: member(['m1', 'm3']), tenants: [tenantA] });
  assert.equal(revoked.activeMallId, null);
  const single = authReducer(restored('tA', 'm2'), { type: 'SET_PROFILE', user: member(['m1']), tenants: [tenantA] });
  assert.equal(single.activeMallId, 'm1', 'single remaining AVM is auto-selected');
});

test('user choice and failures clear pending scope', () => {
  let s = authReducer(restored('tA', 'm2'), { type: 'SET_PROFILE', user: superAdmin, tenants: [tenantA] });
  assert.equal(authReducer(s, { type: 'SELECT_MALL', mallId: 'm1' }).pendingMallId, null);
  assert.equal(authReducer(s, { type: 'SELECT_TENANT', tenantId: 'tA' }).pendingMallId, null);
  s = authReducer(s, { type: 'SET_MALLS_FAILED', tenantId: 'tA', error: 'x' });
  assert.deepEqual(plain([s.activeMallId, s.pendingMallId]), [null, null]);
});

test('fresh normal-user login resolves one AVM, requests a choice for many, and never invents missing access', () => {
  for (const ids of [[], ['m1'], ['m1', 'm2']]) {
    const signedIn = authReducer(restored('old-tenant', 'old-mall'), {
      type: 'SET_SESSION', accessToken: 'new-token', refreshToken: 'refresh', email: 'member@example.test',
    });
    const result = authReducer(signedIn, { type: 'SET_PROFILE', user: member(ids), tenants: [tenantA] });
    assert.equal(result.activeTenantId, 'tA');
    assert.equal(result.activeMallId, ids.length === 1 ? 'm1' : null);
    assert.deepEqual(plain(result.malls.map(m => m.id)), ids);
    assert.equal(result.pendingMallId, null);
  }
});
