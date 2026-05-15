import { PrismaClient, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import {
  runContentSchedulingTick,
  type ScheduleTransition,
} from '@modern-cms/content-scheduling';

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const pollMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? '60000');
const batchSize = Number(process.env.SCHEDULING_BATCH_SIZE ?? '40');
const appVersion = process.env.APP_VERSION ?? '0.0.0';
const gitSha = process.env.APP_GIT_SHA ?? 'unknown';

function maskDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(invalid DATABASE_URL)';
  }
}

async function writeHeartbeat(redis: Redis): Promise<void> {
  const ttl = Math.max(180, Math.floor(pollMs * 3));
  await redis.set(
    'worker:heartbeat',
    JSON.stringify({
      at: new Date().toISOString(),
      version: appVersion,
      gitSha,
    }),
    'EX',
    ttl,
  );
}

function cacheSegment(mallId: string | null): string {
  return mallId ?? 'none';
}

async function invalidatePublicBranch(
  redis: Redis,
  tenantId: string,
  mallId: string | null,
): Promise<void> {
  const pattern = `public:${tenantId}:${cacheSegment(mallId)}:*`;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.error('[service=worker] cache invalidate failed', err);
  }
}

async function writeSystemAudit(
  prisma: PrismaClient,
  t: ScheduleTransition,
): Promise<void> {
  const action = `${t.kind}:auto-${t.action === 'publish' ? 'publish' : 'archive'}`;
  const metadata: Record<string, unknown> = {
    before: { status: t.previousStatus },
    after: { status: t.nextStatus, scheduledExecution: true },
  };
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: null,
        tenantId: t.tenantId,
        mallId: t.mallId,
        action,
        resource: t.kind,
        resourceId: t.id,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error('[service=worker] audit log failed', err);
  }
}

async function writeSchedulingNotification(
  prisma: PrismaClient,
  t: ScheduleTransition,
): Promise<void> {
  const kindLabel: Record<ScheduleTransition['kind'], string> = {
    slider: 'Slider',
    event: 'Etkinlik',
    campaign: 'Kampanya',
    page: 'Sayfa',
    popup: 'Popup',
  };
  const label = kindLabel[t.kind];
  const isPublish = t.action === 'publish';
  const title = isPublish ? `${label} otomatik yayımlandı` : `${label} otomatik arşivlendi`;
  const message = isPublish
    ? `Kayıt zamanlamaya göre yayımlandı (${t.previousStatus} → ${t.nextStatus}).`
    : `Kayıt zamanlamaya göre arşivlendi (${t.previousStatus} → ${t.nextStatus}).`;
  try {
    await prisma.notification.create({
      data: {
        tenantId: t.tenantId,
        mallId: t.mallId,
        userId: null,
        type: 'SCHEDULING',
        severity: 'SUCCESS',
        title,
        message,
        entityType: t.kind,
        entityId: t.id,
        metadataJson: { transition: t } as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error('[service=worker] notification create failed', err);
  }
}

async function writeSchedulingFailureNotification(
  prisma: PrismaClient,
  err: unknown,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  try {
    await prisma.notification.create({
      data: {
        tenantId: null,
        mallId: null,
        userId: null,
        type: 'SYSTEM',
        severity: 'ERROR',
        title: 'Zamanlama işi başarısız',
        message: message.slice(0, 2000),
        metadataJson: { workerFailure: true } as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    console.error('[service=worker] failure notification create failed', e);
  }
}

async function main(): Promise<void> {
  if (!databaseUrl) {
    console.error('[service=worker] DATABASE_URL is required');
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
  });

  redis.on('error', (err: Error) => console.error('[service=worker] redis error', err));

  try {
    await prisma.$connect();
    await redis.ping();
    await writeHeartbeat(redis);
  } catch (err) {
    console.error('[service=worker] connect failed', err);
    await prisma.$disconnect().catch(() => undefined);
    await redis.quit().catch(() => undefined);
    process.exit(1);
  }

  console.log(
    `[service=worker] ready poll=${pollMs}ms redis=${redisUrl} db=${maskDatabaseUrl(databaseUrl)} version=${appVersion} gitSha=${gitSha}`,
  );

  const tick = async (): Promise<void> => {
    try {
      const { transitions } = await runContentSchedulingTick(prisma, {
        now: new Date(),
        batchSize,
      });
      for (const t of transitions) {
        await writeSystemAudit(prisma, t);
        await writeSchedulingNotification(prisma, t);
        await invalidatePublicBranch(redis, t.tenantId, t.mallId);
      }
      if (transitions.length > 0) {
        console.log(
          `[service=worker] schedulingTick at=${new Date().toISOString()} transitions=${transitions.length}`,
        );
      } else {
        console.log(`[service=worker] tickOk at=${new Date().toISOString()}`);
      }
    } catch (err) {
      console.error('[service=worker] scheduling tick failed', err);
      await writeSchedulingFailureNotification(prisma, err);
    } finally {
      await writeHeartbeat(redis).catch(() => undefined);
    }
  };

  await tick();
  const timer = setInterval(() => void tick(), pollMs);

  const shutdown = async () => {
    clearInterval(timer);
    await prisma.$disconnect().catch(() => undefined);
    await redis.quit().catch(() => undefined);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error('[service=worker] fatal', err);
  process.exit(1);
});
