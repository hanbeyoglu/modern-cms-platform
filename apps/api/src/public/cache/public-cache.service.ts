import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { shouldInitializeInfrastructure } from '../../common/app-mode';

@Injectable()
export class PublicCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublicCacheService.name);
  private client: Redis | null = null;
  private available = false;
  private closing = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (!shouldInitializeInfrastructure('redis')) {
      this.logger.debug('Skipping Redis init — swagger mode');
      return;
    }

    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    try {
      this.client = new Redis(url, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
        connectTimeout: 2000,
        retryStrategy: (times) => (this.closing ? null : Math.min(times * 500, 10000)),
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

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    this.closing = true;
    this.client.removeAllListeners();
    this.client.disconnect(false);
    this.client = null;
    this.available = false;
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

  /**
   * Atomically increment a counter and set TTL on first write.
   * Used for sliding-window rate limiting. Returns the new count.
   * Falls back to 0 (allow) when Redis is unavailable.
   */
  async increment(key: string, ttlSeconds: number): Promise<number> {
    if (!this.client || !this.available) return 0;
    try {
      const count = await this.client.incr(key);
      if (count === 1) {
        await this.client.expire(key, ttlSeconds);
      }
      return count;
    } catch {
      return 0;
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
