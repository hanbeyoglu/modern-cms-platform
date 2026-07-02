import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Worker, Queue } from 'bullmq';
import {
  runContentSchedulingTick,
  type ScheduleTransition,
} from '@modern-cms/content-scheduling';
import {
  MOVIE_SYNC_QUEUE_NAME,
  MOVIE_IMPORT_QUEUE_NAME,
  movieImportJobId,
  maskRedisUrl,
  parseRedisConnection,
  createTmdbProvider,
  runMovieSync,
  runMovieImportBulkJob,
  DEFAULT_MOVIE_PROVIDERS_SETTINGS,
  resolveTmdbAccessToken,
  type MovieSyncJobData,
  type MovieImportBulkJobData,
  type MovieProvidersSettings,
} from '@modern-cms/movie-providers';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
loadEnv({ path: resolve(repoRoot, '.env') });
loadEnv({ path: resolve(repoRoot, '.env.local') });

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const bullConnection = parseRedisConnection(redisUrl);
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

function withWorkerPrismaPoolLimits(url: string): string {
  try {
    const parsed = new URL(url);
    const limit = Number(process.env.WORKER_PRISMA_CONNECTION_LIMIT ?? 2);
    const timeout = Number(process.env.PRISMA_POOL_TIMEOUT ?? 20);
    parsed.searchParams.set('connection_limit', String(limit > 0 ? limit : 2));
    parsed.searchParams.set('pool_timeout', String(timeout > 0 ? timeout : 20));
    return parsed.toString();
  } catch {
    return url;
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

async function writeSystemAudit(prisma: PrismaClient, t: ScheduleTransition): Promise<void> {
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
        metadata: metadata as never,
      },
    });
  } catch (err) {
    console.error('[service=worker] audit log failed', err);
  }
}

async function writeSchedulingNotification(prisma: PrismaClient, t: ScheduleTransition): Promise<void> {
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
        metadataJson: { transition: t } as never,
      },
    });
  } catch (err) {
    console.error('[service=worker] notification create failed', err);
  }
}

async function writeSchedulingFailureNotification(prisma: PrismaClient, err: unknown): Promise<void> {
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
        metadataJson: { workerFailure: true } as never,
      },
    });
  } catch (e) {
    console.error('[service=worker] failure notification create failed', e);
  }
}

async function resolveSystemUserId(prisma: PrismaClient, tenantId: string): Promise<string> {
  const tu = await prisma.tenantUser.findFirst({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  });
  if (tu) return tu.userId;
  const superAdmin = await prisma.user.findFirst({
    where: { isSuperAdmin: true, deletedAt: null },
    select: { id: true },
  });
  if (superAdmin) return superAdmin.id;
  throw new Error('Senkronizasyon için sistem kullanıcısı bulunamadı');
}

async function getMovieProvidersSettings(
  prisma: PrismaClient,
  tenantId: string,
): Promise<MovieProvidersSettings> {
  const row = await prisma.tenantSetting.findUnique({
    where: { tenantId_key: { tenantId, key: 'movieProviders' } },
  });
  const stored = (row?.value ?? {}) as Partial<MovieProvidersSettings>;
  return {
    tmdb: { ...DEFAULT_MOVIE_PROVIDERS_SETTINGS.tmdb, ...(stored.tmdb ?? {}) },
  };
}

function parseCronTime(cronTime: string): { hour: number; minute: number } {
  const [h, m] = cronTime.split(':').map((v) => Number(v));
  return { hour: h ?? 3, minute: m ?? 0 };
}

function shouldRunCron(cronTime: string, lastRunKey: string, redis: Redis): Promise<boolean> {
  return (async () => {
    const { hour, minute } = parseCronTime(cronTime);
    const now = new Date();
    if (now.getHours() !== hour || now.getMinutes() !== minute) return false;
    const ran = await redis.get(lastRunKey);
    if (ran) {
      const ranDate = new Date(ran);
      if (ranDate.toDateString() === now.toDateString()) return false;
    }
    await redis.set(lastRunKey, now.toISOString(), 'EX', 86400);
    return true;
  })();
}

async function processMovieSyncJob(prisma: PrismaClient, data: MovieSyncJobData): Promise<void> {
  const settings = await getMovieProvidersSettings(prisma, data.tenantId);
  if (!settings.tmdb.syncEnabled) {
    console.log(`[service=worker] movieSync skipped tenant=${data.tenantId} sync disabled`);
    return;
  }
  const accessToken = resolveTmdbAccessToken(settings.tmdb.readAccessToken);
  if (!accessToken) {
    console.warn(`[service=worker] movieSync skipped tenant=${data.tenantId} no token`);
    return;
  }

  const provider = createTmdbProvider({
    accessToken,
    language: settings.tmdb.language,
    region: settings.tmdb.region,
    posterSize: settings.tmdb.posterSize,
  });

  const systemUserId = data.userId ?? (await resolveSystemUserId(prisma, data.tenantId));
  const result = await runMovieSync({
    prisma,
    provider,
    tenantId: data.tenantId,
    systemUserId,
  });

  await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId: data.tenantId, key: 'movieProviders' } },
    update: {
      value: {
        tmdb: {
          ...settings.tmdb,
          lastSync: {
            status: result.status,
            newMovies: result.newMovies,
            updatedMovies: result.updatedMovies,
            errors: result.failedMovies,
            finishedAt: new Date().toISOString(),
          },
        },
      },
    },
    create: {
      tenantId: data.tenantId,
      key: 'movieProviders',
      value: {
        tmdb: {
          ...settings.tmdb,
          lastSync: {
            status: result.status,
            newMovies: result.newMovies,
            updatedMovies: result.updatedMovies,
            errors: result.failedMovies,
            finishedAt: new Date().toISOString(),
          },
        },
      },
    },
  });

  console.log(
    `[service=worker] movieSync done tenant=${data.tenantId} new=${result.newMovies} updated=${result.updatedMovies} failed=${result.failedMovies}`,
  );
}

async function main(): Promise<void> {
  if (!databaseUrl) {
    console.error('[service=worker] DATABASE_URL is required');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: withWorkerPrismaPoolLimits(databaseUrl) } },
  });
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
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

  const movieSyncWorker = new Worker<MovieSyncJobData>(
    MOVIE_SYNC_QUEUE_NAME,
    async (job) => {
      await processMovieSyncJob(prisma, job.data);
    },
    { connection: { ...bullConnection, maxRetriesPerRequest: null }, concurrency: 1 },
  );

  movieSyncWorker.on('failed', (job, err) => {
    console.error(`[service=worker] movieSync job failed id=${job?.id}`, err);
  });

  const movieImportWorker = new Worker<MovieImportBulkJobData>(
    MOVIE_IMPORT_QUEUE_NAME,
    async (job) => {
      console.log(
        `[MovieImportWorker] Received job ${job.id ?? movieImportJobId(job.data.batchId)}`,
      );
      await runMovieImportBulkJob(prisma, job.data, async (progress) => {
        await job.updateProgress(progress);
      });
    },
    { connection: { ...bullConnection, maxRetriesPerRequest: null }, concurrency: 1 },
  );

  movieImportWorker.on('active', (job) => {
    console.log(`[MovieImportWorker] Active job ${job.id}`);
  });

  movieImportWorker.on('completed', (job) => {
    console.log(`[MovieImportWorker] Completed job ${job.id}`);
  });

  movieImportWorker.on('failed', (job, err) => {
    console.error(`[MovieImportWorker] Failed job ${job?.id}`, err);
  });

  movieImportWorker.on('error', (err) => {
    console.error('[MovieImportWorker] Error', err);
  });

  movieImportWorker.on('stalled', (jobId) => {
    console.warn(`[MovieImportWorker] Stalled job ${jobId}`);
  });

  const movieSyncQueue = new Queue<MovieSyncJobData>(MOVIE_SYNC_QUEUE_NAME, {
    connection: bullConnection,
  });

  await movieSyncWorker.waitUntilReady();
  await movieImportWorker.waitUntilReady();
  console.log(`[MovieImportWorker] Listening on queue ${MOVIE_IMPORT_QUEUE_NAME}`);

  console.log(
    `[service=worker] ready poll=${pollMs}ms redis=${maskRedisUrl(redisUrl)} db=${maskDatabaseUrl(databaseUrl)} version=${appVersion} gitSha=${gitSha}`,
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

      const tenants = await prisma.tenant.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });

      for (const tenant of tenants) {
        const settings = await getMovieProvidersSettings(prisma, tenant.id);
        if (!settings.tmdb.syncEnabled) continue;
        if (!resolveTmdbAccessToken(settings.tmdb.readAccessToken)) continue;

        const cronKey = `movie-sync:cron:${tenant.id}`;
        const shouldRun = await shouldRunCron(settings.tmdb.cronTime, cronKey, redis);
        if (!shouldRun) continue;

        await movieSyncQueue.add(
          'sync',
          { tenantId: tenant.id, provider: 'TMDB', triggeredBy: 'cron' },
          { jobId: `cron-${tenant.id}-${new Date().toISOString().slice(0, 10)}` },
        );
        console.log(`[service=worker] movieSync cron enqueued tenant=${tenant.id}`);
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
    await movieSyncWorker.close();
    await movieImportWorker.close();
    await movieSyncQueue.close();
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
