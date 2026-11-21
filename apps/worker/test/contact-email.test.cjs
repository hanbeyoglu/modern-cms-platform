const assert = require('node:assert/strict');
const { test } = require('node:test');
const { classifyMailError, contactEmailJobId, contactEmailRfcMessageId } = require('@modern-cms/mail');
const {
  markContactEmailFailed,
  processContactEmailJob,
  recoverPendingContactEmails,
} = require('../dist/contact-email.js');

test('contact email job id equals message id for idempotency', () => {
  assert.equal(contactEmailJobId('msg_123'), 'msg_123');
  assert.match(contactEmailRfcMessageId('msg_123'), /^<contact-msg_123@/);
});

test('classifyMailError never returns raw address-bearing provider text', () => {
  assert.equal(
    classifyMailError(new Error("Can't send mail to <support@mall.example>")),
    'smtp_error',
  );
  assert.equal(classifyMailError(new Error('connect ECONNREFUSED 127.0.0.1')), 'smtp_network');
  assert.equal(classifyMailError(Object.assign(new Error('x'), { code: 'smtp_auth' })), 'smtp_auth');
});

test('processContactEmailJob skips when mall supportEmail is empty and keeps CMS row', async () => {
  const updates = [];
  const prisma = {
    contactMessage: {
      findFirst: async () => ({
        id: 'msg1',
        name: 'Ali',
        email: 'ali@example.test',
        phone: null,
        subject: 'Konu',
        message: 'Merhaba',
        emailNotificationStatus: 'PENDING',
        emailNotificationDispatchId: null,
        emailNotificationProviderId: null,
        mall: { name: 'AVM', displayName: null, supportEmail: null },
      }),
      updateMany: async (args) => {
        updates.push(args);
        return { count: 1 };
      },
    },
  };
  await processContactEmailJob(prisma, {
    messageId: 'msg1',
    tenantId: 'tenant',
    mallId: 'mall',
  });
  assert.equal(updates[0].data.emailNotificationStatus, 'SKIPPED');
  assert.deepEqual(updates[0].where, {
    id: 'msg1',
    tenantId: 'tenant',
    mallId: 'mall',
    emailNotificationStatus: 'PENDING',
  });
});

test('processContactEmailJob finalizes SENT without sending when provider id already stored', async () => {
  const updates = [];
  const prisma = {
    contactMessage: {
      findFirst: async () => ({
        id: 'msg1',
        name: 'Ali',
        email: 'ali@example.test',
        phone: null,
        subject: 'Konu',
        message: 'Merhaba',
        emailNotificationStatus: 'PENDING',
        emailNotificationDispatchId: 'contact-email:msg1',
        emailNotificationProviderId: '<already-accepted@smtp>',
        mall: { name: 'AVM', displayName: null, supportEmail: 'support@mall.example' },
      }),
      updateMany: async (args) => {
        updates.push(args);
        return { count: 1 };
      },
    },
  };
  await processContactEmailJob(prisma, {
    messageId: 'msg1',
    tenantId: 'tenant',
    mallId: 'mall',
  });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].data.emailNotificationStatus, 'SENT');
  assert.equal(updates[0].data.emailNotificationProviderId, '<already-accepted@smtp>');
});

test('processContactEmailJob ignores already SENT rows', async () => {
  let updated = false;
  const prisma = {
    contactMessage: {
      findFirst: async () => ({
        id: 'msg1',
        emailNotificationStatus: 'SENT',
        emailNotificationDispatchId: null,
        emailNotificationProviderId: null,
        mall: { name: 'AVM', supportEmail: 'a@b.c' },
      }),
      updateMany: async () => {
        updated = true;
        return { count: 1 };
      },
    },
  };
  await processContactEmailJob(prisma, {
    messageId: 'msg1',
    tenantId: 'tenant',
    mallId: 'mall',
  });
  assert.equal(updated, false);
});

test('markContactEmailFailed only updates PENDING rows without provider acceptance', async () => {
  const updates = [];
  const prisma = {
    contactMessage: {
      updateMany: async (args) => {
        updates.push(args);
        return { count: 1 };
      },
    },
  };
  await markContactEmailFailed(prisma, {
    messageId: 'msg1',
    tenantId: 'tenant',
    mallId: 'mall',
  });
  assert.equal(updates[0].data.emailNotificationStatus, 'FAILED');
  assert.equal(updates[0].where.emailNotificationProviderId, null);
});

test('recoverPendingContactEmails retries failed BullMQ jobs instead of no-op on duplicate id', async () => {
  const actions = [];
  const prisma = {
    contactMessage: {
      findMany: async () => [
        { id: 'a', tenantId: 't1', mallId: 'm1' },
        { id: 'b', tenantId: 't2', mallId: 'm2' },
        { id: 'c', tenantId: 't3', mallId: 'm3' },
      ],
    },
  };
  const count = await recoverPendingContactEmails(prisma, {
    getJob: async (jobId) => {
      if (jobId === 'a') {
        return {
          getState: async () => 'failed',
          retry: async () => {
            actions.push('retry:a');
          },
          remove: async () => undefined,
        };
      }
      if (jobId === 'b') {
        return {
          getState: async () => 'waiting',
          retry: async () => {
            actions.push('retry:b');
          },
          remove: async () => undefined,
        };
      }
      return null;
    },
    add: async (data) => {
      actions.push(`add:${data.messageId}`);
    },
  });
  assert.equal(count, 2);
  assert.deepEqual(actions, ['retry:a', 'add:c']);
});
