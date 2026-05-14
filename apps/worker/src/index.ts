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
    console.error('[worker] cache invalidate failed', err);
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
    console.error('[worker] audit log failed', err);
  }
}

async function main(): Promise<void> {
  if (!databaseUrl) {
    console.error('[worker] DATABASE_URL is required');
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
  });

  redis.on('error', (err: Error) => console.error('[worker] redis error', err));

  try {
    await prisma.$connect();
    await redis.ping();
  } catch (err) {
    console.error('[worker] connect failed', err);
    await prisma.$disconnect().catch(() => undefined);
    await redis.quit().catch(() => undefined);
    process.exit(1);
  }

  console.log(`[worker] ready poll=${pollMs}ms redis=${redisUrl}`);

  const tick = async (): Promise<void> => {
    try {
      const { transitions } = await runContentSchedulingTick(prisma, {
        now: new Date(),
        batchSize,
      });
      for (const t of transitions) {
        await writeSystemAudit(prisma, t);
        await invalidatePublicBranch(redis, t.tenantId, t.mallId);
      }
      if (transitions.length > 0) {
        console.log(
          `[worker] scheduling tick at=${new Date().toISOString()} transitions=${transitions.length}`,
        );
      } else {
        console.log(`[worker] tick ok at=${new Date().toISOString()}`);
      }
    } catch (err) {
      console.error('[worker] scheduling tick failed', err);
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
  console.error('[worker] fatal', err);
  process.exit(1);
});
