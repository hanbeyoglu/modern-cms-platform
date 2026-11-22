const assert = require('node:assert/strict');
const { test } = require('node:test');
const { MediaService } = require('../dist/media/media.service');

function makeService(storage) {
  const prisma = {
    tenant: { findUnique: async () => ({ slug: 'demo' }) },
    mediaAsset: {
      create: async ({ data }) => ({
        ...data,
        id: 'asset-1',
        durationSeconds: null,
        caption: null,
        description: null,
        focalPointX: null,
        focalPointY: null,
        dominantColor: null,
        source: null,
        checksum: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
  };
  const imageProcessor = {
    processForUpload: async (buffer, mimeType) => ({
      buffer,
      mimeType,
      extension: 'webp',
      size: buffer.length,
      width: 100,
      height: 80,
    }),
  };
  const audit = { logAction: async () => undefined };
  return new MediaService(prisma, storage, imageProcessor, audit);
}

test('object storage upload failure returns 503 and does not create a success payload', async () => {
  const storage = {
    kind: 'object',
    upload: async () => {
      throw new Error('AccessDenied');
    },
    delete: async () => undefined,
    getPublicUrl: (key) => `https://media.example.com/${key}`,
  };
  const service = makeService(storage);
  await assert.rejects(
    () =>
      service.uploadAsset(
        { buffer: Buffer.from('img'), mimetype: 'image/png', originalname: 'a.png', size: 3 },
        { id: 'user' },
        'tenant',
        { usageContext: 'EVENT_COVER' },
      ),
    (err) => err?.status === 503 || err?.statusCode === 503 || /Medya depolama/.test(String(err)),
  );
});

test('admin media responses prefer live object-storage public URL over localhost DB snapshot', async () => {
  const row = {
    id: 'asset-1',
    tenantId: 'tenant',
    mallId: null,
    folderId: null,
    originalName: 'a.png',
    fileName: 'a.webp',
    mimeType: 'image/webp',
    extension: 'webp',
    size: 10,
    width: 1,
    height: 1,
    durationSeconds: null,
    storageKey: 'tenants/demo/events/a.webp',
    publicUrl: 'http://localhost:4000/uploads/tenants/demo/events/a.webp',
    altText: null,
    caption: null,
    description: null,
    tags: [],
    focalPointX: null,
    focalPointY: null,
    dominantColor: null,
    source: null,
    checksum: null,
    status: 'ACTIVE',
    usageContext: 'EVENT_COVER',
    suggestedWidth: null,
    suggestedHeight: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const storage = {
    kind: 'object',
    upload: async () => undefined,
    delete: async () => undefined,
    getPublicUrl: (key) => `https://media.example.com/${key}`,
  };
  const prisma = {
    tenant: { findUnique: async () => ({ slug: 'demo' }) },
    mediaAsset: {
      create: async () => row,
      findFirst: async () => row,
    },
  };
  const service = new MediaService(
    prisma,
    storage,
    { processForUpload: async () => ({}) },
    { logAction: async () => undefined },
  );
  const response = await service.getAsset('asset-1', 'tenant');
  assert.equal(response.publicUrl, 'https://media.example.com/tenants/demo/events/a.webp');
});
