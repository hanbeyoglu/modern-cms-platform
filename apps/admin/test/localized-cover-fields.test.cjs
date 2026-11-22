const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
function harness() {
  let selected = null;
  const context = { exports: {}, require: id => id === 'react' ? { ...React, useState: () => [selected, value => { selected = value; }] } : require(id) };
  const source = fs.readFileSync(require.resolve('../src/components/LocalizedCoverFields.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports.LocalizedCoverFields;
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  return [...(node.type === type ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child, type))];
}
const locales = [{ id: 'en', code: 'en', isActive: true }, { id: 'tr', code: 'tr', isActive: true, isDefault: true }, { id: 'de', code: 'de', isActive: false }];
test('cover language controls stay in place, default first, switching preserves per-language values', () => {
  const render = harness();
  const values = { tr: 'tr-image', en: 'en-image' };
  let rendered;
  const props = { locales, renderFields: id => { rendered = values[id]; return React.createElement('span', null, rendered); } };
  const first = render(props);
  assert.equal(rendered, 'tr-image');
  const buttons = nodes(first, 'button');
  assert.equal(buttons.length, 2);
  buttons[0].props.onClick();
  render(props); assert.equal(rendered, 'en-image');
  buttons[1].props.onClick();
  render(props); assert.equal(rendered, 'tr-image');
});
test('missing languages show a status, late-loaded and removed selections fall back safely', () => {
  const render = harness();
  assert.equal(render({ locales: [], renderFields: () => { throw Error('must not render'); } }).props.role, 'status');
  let active;
  const props = { locales, renderFields: id => { active = id; return null; } };
  nodes(render(props), 'button')[0].props.onClick();
  render({ ...props, locales: [locales[1]], disabled: true });
  assert.equal(active, 'tr');
  assert.ok(nodes(render({ ...props, disabled: true }), 'button').every(b => b.props.disabled));
});
