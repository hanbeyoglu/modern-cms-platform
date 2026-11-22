const assert = require('node:assert/strict');
const { test } = require('node:test');
const { sanitizeRichText: clean } = require('../dist/common/utils/rich-text');

test('campaign formatting retains colors, alignment, headings and lists', () => {
  const html = '<h2>Fırsat</h2><p style="text-align: center"><span style="color: #ff0000">Kırmızı</span><strong>Kalın</strong><em>İtalik</em></p><ol><li>Bir</li><li>İki</li></ol><ul><li>Koşul</li></ul>';
  assert.equal(clean(html), html.replace(/: /g, ':'));
});
test('legacy plain text keeps its exact value and newlines', () => {
  const text = 'İlk satır\nİkinci satır & %20 indirim';
  assert.equal(clean(text), text);
  assert.equal(clean(''), '');
});
test('scripts, events, embedded frames and unsafe CSS are removed', () => {
  const safe = clean('<p onclick="alert(1)" style="position:fixed;color:#ff0000;background:url(javascript:alert(1))">Metin<script>alert(1)</script><iframe src="https://bad.test"></iframe><img src=x onerror=alert(1)></p>');
  assert.equal(safe, '<p style="color:#ff0000">Metin</p>');
});
test('links disallow javascript/data and protocol relative URLs and set safe attributes', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,test', '//bad.test', 'java&#x73;cript:alert(1)']) {
    assert.ok(!clean(`<p><a href="${href}">Link</a></p>`).includes('href='));
  }
  const safe = clean('<p><a href="https://example.com">Link</a></p>');
  assert.ok(safe.includes('href="https://example.com"'));
  assert.ok(safe.includes('rel="noopener noreferrer"'));
});
