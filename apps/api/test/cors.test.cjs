const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRequire } = require('node:module');
const cors = createRequire(require.resolve('@nestjs/platform-express'))('cors');
const { parseCorsOrigins } = require('../dist/common/cors-origins');
const {
  buildCorsOptions,
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
} = require('../dist/common/cors-options');

function applyCors(configuration, req) {
  const headers = new Map();
  let statusCode;
  const options = buildCorsOptions(configuration);
  cors(options)(
    req,
    {
      statusCode: 200,
      getHeader: (name) => headers.get(String(name).toLowerCase()),
      setHeader: (name, value) => headers.set(String(name).toLowerCase(), value),
      end: () => {},
    },
    (error) => {
      if (error) throw error;
    },
  );
  return { headers, statusCode };
}

function responseOrigin(configuration, origin) {
  const { headers } = applyCors(configuration, {
    method: 'GET',
    headers: origin === undefined ? {} : { origin },
  });
  return headers.get('access-control-allow-origin');
}

function preflight(configuration, origin, requestHeaders) {
  const { headers } = applyCors(configuration, {
    method: 'OPTIONS',
    headers: {
      origin,
      'access-control-request-method': 'GET',
      'access-control-request-headers': requestHeaders,
    },
  });
  return headers;
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

test('production-style list allows metrogarden without wildcard', () => {
  const configuration =
    'localhost,https://modern-cms.hanbeyoglu.com,https://metrogarden.hanbeyoglu.com';
  assert.equal(
    responseOrigin(configuration, 'https://metrogarden.hanbeyoglu.com'),
    'https://metrogarden.hanbeyoglu.com',
  );
  assert.equal(
    responseOrigin(configuration, 'https://modern-cms.hanbeyoglu.com'),
    'https://modern-cms.hanbeyoglu.com',
  );
  assert.equal(responseOrigin(configuration, 'https://evil.example'), undefined);
  assert.ok(!parseCorsOrigins(configuration).includes('*'));
});

test('OPTIONS preflight returns ACAO and public API headers for metrogarden', () => {
  const configuration =
    'localhost,https://modern-cms.hanbeyoglu.com,https://metrogarden.hanbeyoglu.com';
  const headers = preflight(
    configuration,
    'https://metrogarden.hanbeyoglu.com',
    'accept,x-api-key,x-tenant-id,x-mall-id',
  );
  assert.equal(headers.get('access-control-allow-origin'), 'https://metrogarden.hanbeyoglu.com');
  const allowedHeaders = String(headers.get('access-control-allow-headers') ?? '').toLowerCase();
  for (const header of ['accept', 'content-type', 'x-api-key', 'x-tenant-id', 'x-mall-id']) {
    assert.match(allowedHeaders, new RegExp(header));
  }
  const allowedMethods = String(headers.get('access-control-allow-methods') ?? '').toUpperCase();
  assert.match(allowedMethods, /\bGET\b/);
  assert.equal(headers.get('access-control-allow-credentials'), undefined);
});

test('buildCorsOptions keeps credentials disabled and lists required headers/methods', () => {
  const options = buildCorsOptions('https://metrogarden.hanbeyoglu.com');
  assert.equal(options.credentials, false);
  assert.deepEqual(options.allowedHeaders, [...CORS_ALLOWED_HEADERS]);
  assert.deepEqual(options.methods, [...CORS_ALLOWED_METHODS]);
  assert.ok(options.allowedHeaders.includes('Authorization'));
  assert.ok(options.allowedHeaders.includes('x-api-key'));
});
