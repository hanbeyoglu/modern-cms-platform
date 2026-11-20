const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRequire } = require('node:module');
const cors = createRequire(require.resolve('@nestjs/platform-express'))('cors');
const { parseCorsOrigins } = require('../dist/common/cors-origins');

function responseOrigin(configuration, origin) {
  const headers = new Map();
  cors({ origin: parseCorsOrigins(configuration) })(
    { method: 'GET', headers: origin === undefined ? {} : { origin } },
    {
      getHeader: (name) => headers.get(name.toLowerCase()),
      setHeader: (name, value) => headers.set(name.toLowerCase(), value),
    },
    (error) => { if (error) throw error; },
  );
  return headers.get('access-control-allow-origin');
}

test('bare localhost permits HTTP and HTTPS on different ports', () => {
  for (const origin of ['http://localhost', 'https://localhost', 'http://localhost:5173', 'http://localhost:5174', 'https://localhost:9443']) {
    assert.equal(responseOrigin('localhost', origin), origin);
  }
});

test('bare localhost does not permit lookalikes or other protocols', () => {
  for (const origin of ['http://localhost.example.com:5173', 'http://notlocalhost:5173', 'http://localhost@evil.example', 'http://evil.example/localhost', 'ftp://localhost:5173', 'http://127.0.0.1:5173', 'null']) {
    assert.equal(responseOrigin('localhost', origin), undefined);
  }
});

test('explicit origins preserve exact scheme and port matching', () => {
  assert.equal(responseOrigin('https://example.com', 'https://example.com'), 'https://example.com');
  for (const origin of ['http://example.com', 'https://example.com:8443', 'https://sub.example.com']) {
    assert.equal(responseOrigin('https://example.com', origin), undefined);
  }
  assert.equal(responseOrigin('http://localhost:5173', 'http://localhost:5174'), undefined);
});

test('mixed lists trim entries and do not introduce wildcard support', () => {
  assert.equal(responseOrigin(' localhost, ,https://example.com ', 'http://localhost:5174'), 'http://localhost:5174');
  assert.equal(responseOrigin(' localhost, ,https://example.com ', 'https://example.com'), 'https://example.com');
  assert.equal(responseOrigin('*', 'https://other.example'), undefined);
  assert.equal(responseOrigin('localhost', undefined), undefined);
});
