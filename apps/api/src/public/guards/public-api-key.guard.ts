import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DeveloperApiService } from '../../developer-api/developer-api.service';
import { PublicCacheService } from '../cache/public-cache.service';

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_CACHE_PREFIX = 'ratelimit:';
// Cache allowed domains for 60s to avoid DB hits on every request
const DOMAIN_CACHE_TTL = 60;
const DOMAIN_CACHE_PREFIX = 'allowed_domains:';
// Cache rate limit setting for 120s
const RATE_LIMIT_SETTING_CACHE_TTL = 120;
const RATE_LIMIT_SETTING_CACHE_PREFIX = 'ratelimit_cfg:';

function extractOriginHost(req: Request): string | null {
  const origin = req.headers['origin'];
  if (origin && typeof origin === 'string') {
    try {
      return new URL(origin).hostname;
    } catch {
      return null;
    }
  }
  const referer = req.headers['referer'];
  if (referer && typeof referer === 'string') {
    try {
      return new URL(referer).hostname;
    } catch {
      return null;
    }
  }
  return null;
}

function getIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? null;
}

@Injectable()
export class PublicApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(PublicApiKeyGuard.name);

  constructor(
    private readonly developerApi: DeveloperApiService,
    private readonly cache: PublicCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { publicTenantId?: string; publicApiKeyId?: string }>();
    const res = context.switchToHttp().getResponse<Response>();

    const rawKey = req.headers['x-api-key'];
    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('x-api-key header gerekli');
    }

    const startTime = Date.now();

    // ── 1. Validate API Key ────────────────────────────────────────────────
    const validated = await this.developerApi.validateApiKey(rawKey);
    if (!validated) {
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş API key');
    }

    const { tenantId, keyId } = validated;

    // ── 2. Origin validation ───────────────────────────────────────────────
    const allowedDomains = await this.getAllowedDomains(tenantId);
    if (allowedDomains.length > 0) {
      const originHost = extractOriginHost(req);
      if (originHost) {
        const isAllowed = allowedDomains.includes(originHost);
        if (!isAllowed) {
          this.logRequestAsync({
            tenantId,
            apiKeyId: keyId,
            req,
            statusCode: 403,
            startTime,
          });
          throw new ForbiddenException('Bu origin izinli değil');
        }
      }
    }

    // ── 3. Rate limiting ───────────────────────────────────────────────────
    const rateLimit = await this.getRateLimit(tenantId);
    const rateLimitKey = `${RATE_LIMIT_CACHE_PREFIX}${tenantId}`;
    const current = await this.cache.increment(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);

    res.setHeader('X-RateLimit-Limit', String(rateLimit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rateLimit - current)));

    if (current > rateLimit) {
      this.logRequestAsync({
        tenantId,
        apiKeyId: keyId,
        req,
        statusCode: 429,
        startTime,
      });
      throw new ForbiddenException('Rate limit aşıldı. Lütfen bekleyin.');
    }

    // ── 4. Attach context to request ───────────────────────────────────────
    req.tenantId = tenantId;
    req.publicApiKeyId = keyId;

    // ── 5. Touch lastUsedAt + log asynchronously ───────────────────────────
    void this.developerApi.touchLastUsed(keyId).catch((err: unknown) => {
      this.logger.warn('Failed to update lastUsedAt', err);
    });

    // Log after response is sent
    res.on('finish', () => {
      this.logRequestAsync({
        tenantId,
        apiKeyId: keyId,
        req,
        statusCode: res.statusCode,
        startTime,
      });
    });

    return true;
  }

  private logRequestAsync(opts: {
    tenantId: string;
    apiKeyId: string;
    req: Request;
    statusCode: number;
    startTime: number;
  }): void {
    const { tenantId, apiKeyId, req, statusCode, startTime } = opts;
    void this.developerApi
      .logRequest({
        tenantId,
        apiKeyId,
        endpoint: req.path,
        method: req.method,
        statusCode,
        responseTimeMs: Date.now() - startTime,
        origin: req.headers['origin'] as string | null ?? null,
        ipAddress: getIp(req),
        userAgent: req.headers['user-agent'] ?? null,
      })
      .catch((err: unknown) => {
        this.logger.warn('Failed to write API request log', err);
      });
  }

  private async getAllowedDomains(tenantId: string): Promise<string[]> {
    const cacheKey = `${DOMAIN_CACHE_PREFIX}${tenantId}`;
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached !== null) return cached;

    const domains = await this.developerApi.getAllowedDomains(tenantId);
    await this.cache.set(cacheKey, domains, DOMAIN_CACHE_TTL);
    return domains;
  }

  private async getRateLimit(tenantId: string): Promise<number> {
    const cacheKey = `${RATE_LIMIT_SETTING_CACHE_PREFIX}${tenantId}`;
    const cached = await this.cache.get<number>(cacheKey);
    if (cached !== null) return cached;

    const limit = await this.developerApi.getRateLimitValue(tenantId);
    await this.cache.set(cacheKey, limit, RATE_LIMIT_SETTING_CACHE_TTL);
    return limit;
  }
}
