import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class PublicCacheService implements OnModuleInit {
  private readonly logger = new Logger(PublicCacheService.name);
  private client: Redis | null = null;
  private available = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    try {
      this.client = new Redis(url, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
        connectTimeout: 2000,
        retryStrategy: (times) => Math.min(times * 500, 10000),
      });

      this.client.on('connect', () => {
        this.available = true;
        this.logger.log('Redis connected — public cache active');
      });
      this.client.on('ready', () => {
        this.available = true;
      });
      this.client.on('error', (err: Error) => {
        if (this.available) {
          this.logger.warn(
            `[service=api] [op=publicCache.redis] Redis unavailable: ${err.message} — public cache bypassed`,
          );
        }
        this.available = false;
      });
      this.client.on('reconnecting', () => {
        this.logger.debug('Redis reconnecting...');
      });
    } catch (err: unknown) {
      this.logger.warn(
        `[service=api] [op=publicCache.init] Redis init failed: ${(err as Error).message} — running without cache`,
      );
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.available) return null;
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client || !this.available) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // silent fallback — never crash the API over a cache write
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.available) return;
    try {
      await this.client.del(key);
    } catch {
      // silent fallback
    }
  }

  // ── Invalidation helpers ─────────────────────────────────────────────────

  async invalidateTenant(tenantId: string): Promise<void> {
    await this.invalidatePattern(`public:${tenantId}:*`);
  }

  async invalidateMall(tenantId: string, mallId: string): Promise<void> {
    await this.invalidatePattern(`public:${tenantId}:${mallId}:*`);
  }

  async invalidatePublicKey(keyOrPattern: string): Promise<void> {
    if (keyOrPattern.includes('*')) {
      await this.invalidatePattern(keyOrPattern);
    } else {
      await this.del(keyOrPattern);
    }
  }

  private async invalidatePattern(pattern: string): Promise<void> {
    if (!this.client || !this.available) return;
    try {
      // KEYS is fine for low-cardinality cache namespaces; replace with SCAN for high-volume
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      // silent fallback
    }
  }
}
