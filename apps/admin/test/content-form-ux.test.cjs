const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(relPath, extra = {}) {
  const source = fs.readFileSync(require.resolve(relPath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, Date, ...extra };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

test('save button label describes the outcome for every status', () => {
  const wf = load('../src/lib/publishing-workflow.ts');
  assert.equal(wf.getSaveActionLabel('DRAFT'), 'Taslak olarak kaydet');
  assert.equal(wf.getSaveActionLabel('SCHEDULED'), 'Kaydet ve zamanla');
  assert.equal(wf.getSaveActionLabel('PUBLISHED'), 'Kaydet ve yayınla');
  assert.equal(wf.getSaveActionLabel('ARCHIVED'), 'Kaydet ve arşivle');
});

test('save success message states public visibility', () => {
  const wf = load('../src/lib/publishing-workflow.ts');
  assert.match(wf.getSaveSuccessMessage('Kampanya', 'DRAFT'), /^Kampanya taslak .*görünmez/);
  assert.match(wf.getSaveSuccessMessage('Etkinlik', 'PUBLISHED'), /^Etkinlik .*yayında/);
  assert.match(wf.getSaveSuccessMessage('Kampanya', 'ARCHIVED'), /arşivlendi/);
  assert.match(
    wf.getSaveSuccessMessage('Kampanya', 'SCHEDULED', '2030-01-02T10:00'),
    /otomatik yayına girecek/,
  );
  assert.equal(
    wf.getSaveSuccessMessage('Kampanya', 'SCHEDULED', ''),
    'Kampanya kaydedildi ve zamanlandı.',
  );
});

test('unsaved-changes registry only asks when a form is dirty', () => {
  const reg = load('../src/lib/unsaved-changes.ts');
  let asked = 0;
  const deny = () => { asked += 1; return false; };
  const accept = () => { asked += 1; return true; };

  assert.equal(reg.confirmDiscardUnsavedChanges(deny), true);
  assert.equal(asked, 0);

  reg.setUnsavedChanges('campaign-form', true);
  assert.equal(reg.hasUnsavedChanges(), true);
  assert.equal(reg.confirmDiscardUnsavedChanges(deny), false);
  assert.equal(reg.confirmDiscardUnsavedChanges(accept), true);
  assert.equal(asked, 2);

  reg.setUnsavedChanges('campaign-form', false);
  assert.equal(reg.hasUnsavedChanges(), false);
  assert.equal(reg.confirmDiscardUnsavedChanges(deny), true);
  assert.equal(asked, 2);
});
