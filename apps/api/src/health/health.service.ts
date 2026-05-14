import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

const STARTED_AT = Date.now();

export type HealthComponent = 'up' | 'down' | 'skipped' | 'unknown';

export interface HealthSnapshot {
  status: 'ok' | 'degraded' | 'down';
  uptimeSeconds: number;
  timestamp: string;
  database: HealthComponent;
  redis: HealthComponent;
  worker: { status: HealthComponent; lastBeatAt: string | null };
  version: string;
  gitSha: string;
  buildTime: string;
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private redis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  uptimeSeconds(): number {
    return Math.floor((Date.now() - STARTED_AT) / 1000);
  }

  private getRedisClient(): Redis | null {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) {
      return null;
    }
    if (!this.redis) {
      this.redis = new Redis(url, {
        maxRetriesPerRequest: 2,
        connectTimeout: 3000,
        enableOfflineQueue: false,
      });
      this.redis.on('error', (err: Error) => {
        this.logger.warn(
          `[service=api] [op=health.redis] Health Redis client error: ${err.message}`,
        );
      });
    }
    return this.redis;
  }

  async checkDatabase(): Promise<HealthComponent> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  async checkRedis(): Promise<HealthComponent> {
    const client = this.getRedisClient();
    if (!client) {
      return 'skipped';
    }
    try {
      await client.ping();
      return 'up';
    } catch {
      return 'down';
    }
  }

  async checkWorkerHeartbeat(): Promise<{ status: HealthComponent; lastBeatAt: string | null }> {
    const client = this.getRedisClient();
    if (!client) {
      return { status: 'skipped', lastBeatAt: null };
    }
    try {
      const raw = await client.get('worker:heartbeat');
      if (!raw) {
        return { status: 'unknown', lastBeatAt: null };
      }
      let lastBeatAt: string | null = null;
      try {
        const parsed = JSON.parse(raw) as { at?: string };
        lastBeatAt = parsed.at ?? null;
      } catch {
        lastBeatAt = raw;
      }
      return { status: 'up', lastBeatAt };
    } catch {
      return { status: 'unknown', lastBeatAt: null };
    }
  }

  async getSnapshot(): Promise<HealthSnapshot> {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();
    const worker = await this.checkWorkerHeartbeat();

    const version = this.config.get<string>('APP_VERSION') ?? '0.0.0';
    const gitSha = this.config.get<string>('APP_GIT_SHA') ?? 'unknown';
    const buildTime = this.config.get<string>('APP_BUILD_TIME') ?? 'unknown';

    let status: HealthSnapshot['status'] = 'ok';
    if (database === 'down') {
      status = 'down';
    } else if (redis === 'down') {
      status = 'degraded';
    } else if (redis === 'skipped' && this.config.get<string>('NODE_ENV') === 'production') {
      status = 'degraded';
    }

    return {
      status,
      uptimeSeconds: this.uptimeSeconds(),
      timestamp: new Date().toISOString(),
      database,
      redis,
      worker,
      version,
      gitSha,
      buildTime,
    };
  }

  /** Strict readiness: DB up; Redis up when REDIS_URL is configured. */
  async isReady(): Promise<{ ok: boolean; snapshot: HealthSnapshot }> {
    const snapshot = await this.getSnapshot();
    const redisUrl = this.config.get<string>('REDIS_URL')?.trim();
    const redisRequired = Boolean(redisUrl);
    const redisOk = !redisRequired || snapshot.redis === 'up';
    const ok = snapshot.database === 'up' && redisOk;
    return { ok, snapshot };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
      this.redis = null;
    }
  }
}
