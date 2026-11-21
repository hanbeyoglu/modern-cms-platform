import type { PrismaClient } from '@prisma/client';
import {
  classifyMailError,
  contactEmailDispatchId,
  contactEmailJobId,
  contactEmailRfcMessageId,
  createSmtpTransport,
  resolveSmtpConfig,
  sendContactNotificationEmail,
  type ContactEmailJobData,
} from '@modern-cms/mail';

export type ContactEmailQueueDriver = {
  getJob(jobId: string): Promise<ContactEmailRecoverableJob | null | undefined>;
  add(data: ContactEmailJobData): Promise<void>;
};

export type ContactEmailRecoverableJob = {
  getState(): Promise<string>;
  retry(): Promise<unknown>;
  remove(): Promise<unknown>;
};

async function markSent(
  prisma: PrismaClient,
  data: ContactEmailJobData,
  providerId: string | null,
): Promise<void> {
  await prisma.contactMessage.updateMany({
    where: {
      id: data.messageId,
      tenantId: data.tenantId,
      mallId: data.mallId,
      emailNotificationStatus: { in: ['PENDING', 'FAILED'] },
    },
    data: {
      emailNotificationStatus: 'SENT',
      emailNotificationSentAt: new Date(),
      ...(providerId
        ? { emailNotificationProviderId: providerId }
        : {}),
    },
  });
}

async function recordProviderAcceptance(
  prisma: PrismaClient,
  data: ContactEmailJobData,
  providerId: string,
): Promise<void> {
  await prisma.contactMessage.updateMany({
    where: {
      id: data.messageId,
      tenantId: data.tenantId,
      mallId: data.mallId,
      emailNotificationProviderId: null,
    },
    data: { emailNotificationProviderId: providerId },
  });
}

export async function processContactEmailJob(
  prisma: PrismaClient,
  data: ContactEmailJobData,
): Promise<void> {
  const row = await prisma.contactMessage.findFirst({
    where: {
      id: data.messageId,
      tenantId: data.tenantId,
      mallId: data.mallId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      subject: true,
      message: true,
      emailNotificationStatus: true,
      emailNotificationDispatchId: true,
      emailNotificationProviderId: true,
      mall: { select: { name: true, displayName: true, supportEmail: true } },
    },
  });

  if (!row) {
    console.warn(
      `[service=worker] contactEmail skipped missing messageId=${data.messageId}`,
    );
    return;
  }

  if (
    row.emailNotificationStatus === 'SENT' ||
    row.emailNotificationStatus === 'SKIPPED'
  ) {
    return;
  }

  // SMTP already accepted; only finalize SENT (avoids duplicate send after DB race).
  if (row.emailNotificationProviderId) {
    await markSent(prisma, data, row.emailNotificationProviderId);
    console.log(`[service=worker] contactEmail finalized messageId=${row.id}`);
    return;
  }

  const supportEmail = row.mall.supportEmail?.trim() || '';
  if (!supportEmail) {
    await prisma.contactMessage.updateMany({
      where: {
        id: row.id,
        tenantId: data.tenantId,
        mallId: data.mallId,
        emailNotificationStatus: 'PENDING',
      },
      data: { emailNotificationStatus: 'SKIPPED' },
    });
    console.log(`[service=worker] contactEmail skipped no-support-email messageId=${row.id}`);
    return;
  }

  const smtp = resolveSmtpConfig(process.env);
  if (!smtp) {
    throw Object.assign(new Error('SMTP is not configured'), { code: 'smtp_not_configured' });
  }

  const dispatchId = row.emailNotificationDispatchId ?? contactEmailDispatchId(row.id);
  const rfcMessageId = contactEmailRfcMessageId(row.id);

  if (!row.emailNotificationDispatchId) {
    await prisma.contactMessage.updateMany({
      where: {
        id: row.id,
        tenantId: data.tenantId,
        mallId: data.mallId,
        emailNotificationDispatchId: null,
      },
      data: { emailNotificationDispatchId: dispatchId },
    });
  }

  await prisma.contactMessage.updateMany({
    where: { id: row.id, tenantId: data.tenantId, mallId: data.mallId },
    data: { emailNotificationAttempts: { increment: 1 } },
  });

  const transport = createSmtpTransport(smtp);
  let providerMessageId: string | null = null;
  try {
    const result = await sendContactNotificationEmail({
      transport,
      from: smtp.from,
      to: supportEmail,
      rfcMessageId,
      content: {
        mallName: row.mall.displayName?.trim() || row.mall.name,
        visitorName: row.name,
        visitorEmail: row.email,
        visitorPhone: row.phone,
        subject: row.subject,
        message: row.message,
      },
    });
    // Prefer SMTP response id; fall back to our deterministic Message-ID so acceptance is tracked.
    providerMessageId = result.providerMessageId ?? rfcMessageId;
    await recordProviderAcceptance(prisma, data, providerMessageId);
  } catch (err) {
    const code = classifyMailError(err);
    console.error(
      `[service=worker] contactEmail send failed messageId=${row.id} code=${code}`,
    );
    throw Object.assign(new Error(code), { code });
  } finally {
    transport.close();
  }

  await markSent(prisma, data, providerMessageId);
  console.log(`[service=worker] contactEmail sent messageId=${row.id}`);
}

export async function markContactEmailFailed(
  prisma: PrismaClient,
  data: ContactEmailJobData,
): Promise<void> {
  await prisma.contactMessage.updateMany({
    where: {
      id: data.messageId,
      tenantId: data.tenantId,
      mallId: data.mallId,
      emailNotificationStatus: 'PENDING',
      emailNotificationProviderId: null,
    },
    data: { emailNotificationStatus: 'FAILED' },
  });
  console.warn(`[service=worker] contactEmail failed messageId=${data.messageId}`);
}

/**
 * Re-drive PENDING outbox rows. Inspects BullMQ job state so failed/completed
 * jobs are retried instead of silently no-op'ing on duplicate job ids.
 */
export async function recoverPendingContactEmails(
  prisma: PrismaClient,
  queue: ContactEmailQueueDriver,
  options: { olderThanMs?: number; limit?: number } = {},
): Promise<number> {
  const olderThanMs = options.olderThanMs ?? 60_000;
  const limit = options.limit ?? 50;
  const cutoff = new Date(Date.now() - olderThanMs);
  const pending = await prisma.contactMessage.findMany({
    where: {
      emailNotificationStatus: 'PENDING',
      createdAt: { lt: cutoff },
    },
    select: { id: true, tenantId: true, mallId: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let actions = 0;
  for (const row of pending) {
    const data: ContactEmailJobData = {
      messageId: row.id,
      tenantId: row.tenantId,
      mallId: row.mallId,
    };
    const jobId = contactEmailJobId(row.id);
    try {
      const existing = await queue.getJob(jobId);
      if (!existing) {
        await queue.add(data);
        actions += 1;
        continue;
      }

      const state = await existing.getState();
      if (state === 'waiting' || state === 'delayed' || state === 'active' || state === 'paused') {
        continue;
      }

      if (state === 'failed') {
        await existing.retry();
        actions += 1;
        continue;
      }

      // completed / unknown while DB still PENDING: remove and re-queue so finalization can run.
      await existing.remove();
      await queue.add(data);
      actions += 1;
    } catch (err) {
      const code = classifyMailError(err);
      console.error(
        `[service=worker] contactEmail recovery failed messageId=${row.id} code=${code}`,
      );
    }
  }
  return actions;
}
