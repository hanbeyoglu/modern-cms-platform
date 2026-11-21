const assert = require('node:assert/strict');
const { test } = require('node:test');
const payload = {
  name: 'Visitor',
  email: 'visitor@example.test',
  message: 'Hello mall',
  kvkkConsent: true,
};

test('SDK posts JSON with existing API key/tenant/mall headers and only resolves accepted HTTP responses', async () => {
  const { CmsPublicClient } = require('../dist/client');
  let sent;
  const client = new CmsPublicClient({
    baseUrl: 'https://cms.example.test',
    apiKey: 'test-public-key',
    tenantId: 'tenant',
    mallId: 'mall',
    defaultLocale: 'tr',
    fetchImpl: async (url, options) => {
      sent = { url, options };
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { accepted: true },
          locale: 'tr',
          tenant: { id: 'tenant', mallId: 'mall' },
        }),
      };
    },
  });
  assert.equal((await client.submitContactMessage(payload)).data.accepted, true);
  assert.equal(sent.options.method, 'POST');
  assert.equal(sent.options.headers['Content-Type'], 'application/json');
  assert.equal(sent.options.headers['x-api-key'], 'test-public-key');
  assert.equal(sent.options.headers['x-mall-id'], 'mall');
  assert.deepEqual(JSON.parse(sent.options.body), payload);
  const failed = new CmsPublicClient({
    baseUrl: 'https://cms.example.test',
    apiKey: 'key',
    tenantId: 'tenant',
    mallId: 'mall',
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      json: async () => ({
        success: false,
        error: { code: 'TOO_MANY_REQUESTS', message: 'Try later' },
      }),
    }),
  });
  await assert.rejects(failed.submitContactMessage(payload), (error) => error.status === 429);
});
