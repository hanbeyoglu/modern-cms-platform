const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(relPath) {
  const source = fs.readFileSync(require.resolve(relPath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, JSON };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

const nav = load('../src/navigation/config.ts');
const before = require('./fixtures-nav-access.json');

test('every menu item keeps its route, permission and capability rules', () => {
  const after = {};
  for (const i of nav.NAV_ITEMS) {
    after[i.id] = {
      href: i.href,
      permission: i.permission,
      anyPermission: i.anyPermission ?? null,
      capability: i.capability ?? null,
      superAdminOnly: !!i.superAdminOnly,
      requiresAudit: !!i.requiresAudit,
    };
  }
  assert.deepEqual(JSON.parse(JSON.stringify(after)), before);
});

test('every grouped item belongs to a declared group; daily groups open by default', () => {
  const ids = nav.NAV_GROUPS.map((g) => g.id);
  for (const i of nav.NAV_ITEMS) if (i.group) assert.ok(ids.includes(i.group), i.id);
  const open = JSON.parse(JSON.stringify(nav.NAV_GROUPS.filter((g) => g.defaultOpen).map((g) => g.id)));
  assert.deepEqual(open, ['Genel Bakış', 'İçerik Yönetimi', 'AVM ve Mağazalar']);
  const label = (id) => nav.NAV_ITEMS.find((i) => i.id === id).label;
  assert.equal(label('sliders'), 'Slaytlar');
  assert.equal(label('popups'), 'Açılır Pencereler');
  assert.equal(label('settings-developer-api'), 'API Yönetimi');
});

test('visibility honours audit flag, super admin, permissions and capabilities', () => {
  const ctx = (o = {}) => ({
    isSuperAdmin: false,
    auditEnabled: true,
    can: () => true,
    canAny: () => true,
    hasCapability: () => true,
    ...o,
  });
  const item = (id) => nav.NAV_ITEMS.find((i) => i.id === id);
  assert.equal(nav.isNavItemVisible(item('tenants'), ctx()), false);
  assert.equal(nav.isNavItemVisible(item('tenants'), ctx({ isSuperAdmin: true })), true);
  assert.equal(nav.isNavItemVisible(item('audit-logs'), ctx({ auditEnabled: false })), false);
  assert.equal(nav.isNavItemVisible(item('campaigns'), ctx({ hasCapability: () => false })), false);
  assert.equal(nav.isNavItemVisible(item('campaigns'), ctx({ isSuperAdmin: true, hasCapability: () => false })), true);
  assert.equal(nav.isNavItemVisible(item('campaigns'), ctx({ can: () => false })), false);
  assert.equal(nav.isNavItemVisible(item('floors'), ctx({ canAny: () => false })), false);
});

test('active item matching does not let /media claim /media/guidelines', () => {
  const item = (id) => nav.NAV_ITEMS.find((i) => i.id === id);
  assert.equal(nav.isNavItemActive(item('media'), '/media'), true);
  assert.equal(nav.isNavItemActive(item('media'), '/media/guidelines'), false);
  assert.equal(nav.isNavItemActive(item('media-guidelines'), '/media/guidelines'), true);
  assert.equal(nav.isNavItemActive(item('sliders'), '/sliders/abc'), true);
});

test('menu open state is remembered per user and tolerates bad storage', () => {
  const prefs = load('../src/lib/nav-preferences.ts');
  const mem = new Map();
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  prefs.saveNavOpenState('u1', { 'Genel Bakış': false }, store);
  assert.equal(JSON.parse(JSON.stringify(prefs.loadNavOpenState('u1', store)))['Genel Bakış'], false);
  assert.equal(Object.keys(prefs.loadNavOpenState('u2', store)).length, 0);
  assert.equal(prefs.isSectionOpen({}, 'Yönetim', false), false);
  assert.equal(prefs.isSectionOpen({ Yönetim: true }, 'Yönetim', false), true);
  mem.set('cms.nav.open.u3', '{not json');
  assert.equal(Object.keys(prefs.loadNavOpenState('u3', store)).length, 0);
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.doesNotThrow(() => prefs.saveNavOpenState('u1', {}, throwing));
  assert.equal(Object.keys(prefs.loadNavOpenState('u1', throwing)).length, 0);
});

test('platform (super-admin only) pages do not require a workspace; tenant pages still do', () => {
  assert.equal(nav.isPlatformPath('/tenants'), true);
  assert.equal(nav.isPlatformPath('/tenants/abc'), true);
  assert.equal(nav.isPlatformPath('/capabilities'), true);
  assert.equal(nav.isPlatformPath('/system/localization/languages'), true);
  assert.equal(nav.isPlatformPath('/tenantsx'), false);
  assert.equal(nav.isPlatformPath('/campaigns'), false);
  assert.equal(nav.isPlatformPath('/dashboard'), false);
  assert.equal(nav.isPlatformPath('/locations'), false);
});
