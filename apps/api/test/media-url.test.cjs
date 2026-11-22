const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  isLocalLikeMediaUrl,
  resolveMediaPublicUrl,
  buildObjectStoragePublicUrl,
} = require('../dist/media/media-url');

test('detects localhost, loopback and file URLs as local-like', () => {
  assert.equal(isLocalLikeMediaUrl('http://localhost:4000/uploads/tenants/a/events/x.webp'), true);
  assert.equal(isLocalLikeMediaUrl('https://127.0.0.1/uploads/x.webp'), true);
  assert.equal(isLocalLikeMediaUrl('file:///tmp/x.webp'), true);
  assert.equal(isLocalLikeMediaUrl('https://media.example.com/tenants/a/events/x.webp'), false);
});

test('object storage base rewrites API media URLs away from localhost snapshots', () => {
  const resolved = resolveMediaPublicUrl({
    publicUrl: 'http://localhost:4000/uploads/tenants/demo/events/a.webp',
    storageKey: 'tenants/demo/events/a.webp',
    objectPublicBase: 'https://media.example.com/',
  });
  assert.equal(resolved, 'https://media.example.com/tenants/demo/events/a.webp');
  assert.equal(
    buildObjectStoragePublicUrl('https://media.example.com', 'tenants/demo/events/a.webp'),
    'https://media.example.com/tenants/demo/events/a.webp',
  );
});

test('without object storage base, stored publicUrl is preserved', () => {
  const url = 'http://localhost:4000/uploads/tenants/demo/events/a.webp';
  assert.equal(
    resolveMediaPublicUrl({ publicUrl: url, storageKey: 'tenants/demo/events/a.webp' }),
    url,
  );
});
