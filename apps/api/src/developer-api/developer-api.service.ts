import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { User } from '@prisma/client';
import { ApiKeyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateAllowedDomainDto,
  CreateApiKeyDto,
  ListApiLogsDto,
  UpdateApiKeyDto,
  UpdateRateLimitDto,
} from './dto/developer-api.dto';

const RATE_LIMIT_SETTING_KEY = 'apiRateLimit';
const DEFAULT_RATE_LIMIT = 500;

function generateApiKey(environment: string): { raw: string; hash: string; prefix: string } {
  const envTag = environment === 'PRODUCTION' ? 'live' : environment === 'STAGING' ? 'staging' : 'dev';
  const bytes = randomBytes(32).toString('hex');
  const raw = `pk_${envTag}_${bytes}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 16);
  return { raw, hash, prefix };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function compareApiKey(candidate: string, storedHash: string): boolean {
  const candidateHash = hashApiKey(candidate);
  try {
    return timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

@Injectable()
export class DeveloperApiService {
  constructor(private readonly prisma: PrismaService) {}

  // ── API Keys ──────────────────────────────────────────────────────────────

  async listApiKeys(actor: User, tenantId: string) {
    await this.assertTenantAccess(actor, tenantId);
    return this.prisma.publicApiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        keyPrefix: true,
        environment: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async createApiKey(actor: User, tenantId: string, dto: CreateApiKeyDto) {
    await this.assertTenantAccess(actor, tenantId);

    const environment = dto.environment ?? 'PRODUCTION';
    const { raw, hash, prefix } = generateApiKey(environment);

    const key = await this.prisma.publicApiKey.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        keyHash: hash,
        keyPrefix: prefix,
        environment,
        status: 'ACTIVE',
        createdById: actor.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        keyPrefix: true,
        environment: true,
        status: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    // rawKey is returned only once — never stored
    return { ...key, rawKey: raw };
  }

  async updateApiKey(actor: User, tenantId: string, keyId: string, dto: UpdateApiKeyDto) {
    const key = await this.findKey(tenantId, keyId);
    if (!actor.isSuperAdmin) await this.assertTenantAccess(actor, tenantId);

    if (key.status === 'REVOKED') {
      throw new BadRequestException('Revoke edilmiş key güncellenemez');
    }

    return this.prisma.publicApiKey.update({
      where: { id: keyId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status as ApiKeyStatus }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        keyPrefix: true,
        environment: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async revokeApiKey(actor: User, tenantId: string, keyId: string) {
    const key = await this.findKey(tenantId, keyId);
    if (!actor.isSuperAdmin) await this.assertTenantAccess(actor, tenantId);

    if (key.status === 'REVOKED') {
      throw new BadRequestException('Zaten revoke edilmiş');
    }

    return this.prisma.publicApiKey.update({
      where: { id: keyId },
      data: { status: 'REVOKED', revokedAt: new Date() },
      select: { id: true, status: true, revokedAt: true },
    });
  }

  async regenerateApiKey(actor: User, tenantId: string, keyId: string) {
    const key = await this.findKey(tenantId, keyId);
    if (!actor.isSuperAdmin) await this.assertTenantAccess(actor, tenantId);

    const { raw, hash, prefix } = generateApiKey(key.environment);

    const updated = await this.prisma.publicApiKey.update({
      where: { id: keyId },
      data: {
        keyHash: hash,
        keyPrefix: prefix,
        status: 'ACTIVE',
        revokedAt: null,
        lastUsedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        keyPrefix: true,
        environment: true,
        status: true,
        updatedAt: true,
      },
    });

    return { ...updated, rawKey: raw };
  }

  async deleteApiKey(actor: User, tenantId: string, keyId: string) {
    await this.findKey(tenantId, keyId);
    if (!actor.isSuperAdmin) await this.assertTenantAccess(actor, tenantId);

    await this.prisma.publicApiKey.delete({ where: { id: keyId } });
  }

  // ── Allowed Domains ───────────────────────────────────────────────────────

  async listAllowedDomains(actor: User, tenantId: string) {
    await this.assertTenantAccess(actor, tenantId);
    return this.prisma.allowedDomain.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, domain: true, createdAt: true },
    });
  }

  async addAllowedDomain(actor: User, tenantId: string, dto: CreateAllowedDomainDto) {
    await this.assertTenantAccess(actor, tenantId);

    const normalized = dto.domain.trim().toLowerCase();
    this.validateDomain(normalized);

    const existing = await this.prisma.allowedDomain.findUnique({
      where: { tenantId_domain: { tenantId, domain: normalized } },
    });
    if (existing) throw new ConflictException('Bu domain zaten eklenmiş');

    return this.prisma.allowedDomain.create({
      data: { tenantId, domain: normalized },
      select: { id: true, domain: true, createdAt: true },
    });
  }

  async removeAllowedDomain(actor: User, tenantId: string, domainId: string) {
    await this.assertTenantAccess(actor, tenantId);
    const domain = await this.prisma.allowedDomain.findFirst({
      where: { id: domainId, tenantId },
    });
    if (!domain) throw new NotFoundException('Domain bulunamadı');
    await this.prisma.allowedDomain.delete({ where: { id: domainId } });
  }

  // ── Rate Limits ───────────────────────────────────────────────────────────

  async getRateLimit(actor: User, tenantId: string): Promise<{ requestsPerMinute: number }> {
    await this.assertTenantAccess(actor, tenantId);
    return { requestsPerMinute: await this.getRateLimitValue(tenantId) };
  }

  async updateRateLimit(actor: User, tenantId: string, dto: UpdateRateLimitDto) {
    await this.assertTenantAccess(actor, tenantId);

    await this.prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key: RATE_LIMIT_SETTING_KEY } },
      create: { tenantId, key: RATE_LIMIT_SETTING_KEY, value: { requestsPerMinute: dto.requestsPerMinute } },
      update: { value: { requestsPerMinute: dto.requestsPerMinute } },
    });

    return { requestsPerMinute: dto.requestsPerMinute };
  }

  async getRateLimitValue(tenantId: string): Promise<number> {
    const row = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key: RATE_LIMIT_SETTING_KEY } },
    });
    if (!row) return DEFAULT_RATE_LIMIT;
    const val = row.value as Record<string, unknown>;
    return typeof val?.requestsPerMinute === 'number' ? val.requestsPerMinute : DEFAULT_RATE_LIMIT;
  }

  // ── API Logs ──────────────────────────────────────────────────────────────

  async listApiLogs(actor: User, tenantId: string, query: ListApiLogsDto) {
    await this.assertTenantAccess(actor, tenantId);

    const { limit = 100, apiKeyId, dateFrom, dateTo } = query;

    const where = {
      tenantId,
      ...(apiKeyId ? { apiKeyId } : {}),
      ...((dateFrom || dateTo) ? {
        createdAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        },
      } : {}),
    };

    return this.prisma.apiRequestLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      select: {
        id: true,
        endpoint: true,
        method: true,
        statusCode: true,
        responseTimeMs: true,
        origin: true,
        ipAddress: true,
        createdAt: true,
        apiKey: { select: { id: true, name: true, keyPrefix: true } },
      },
    });
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  async getAnalytics(actor: User, tenantId: string) {
    await this.assertTenantAccess(actor, tenantId);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [todayCount, last7Days, topEndpoints, errorCount, lastUsedKey] = await Promise.all([
      this.prisma.apiRequestLog.count({
        where: { tenantId, createdAt: { gte: todayStart } },
      }),
      this.prisma.apiUsageDaily.findMany({
        where: { tenantId, date: { gte: sevenDaysAgo } },
        orderBy: { date: 'asc' },
        select: { date: true, requestCount: true, successCount: true, errorCount: true },
      }),
      this.prisma.apiRequestLog.groupBy({
        by: ['endpoint'],
        where: { tenantId, createdAt: { gte: sevenDaysAgo } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      this.prisma.apiRequestLog.count({
        where: { tenantId, statusCode: { gte: 400 }, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.publicApiKey.findFirst({
        where: { tenantId, lastUsedAt: { not: null } },
        orderBy: { lastUsedAt: 'desc' },
        select: { id: true, name: true, lastUsedAt: true },
      }),
    ]);

    return {
      todayRequests: todayCount,
      last7Days,
      topEndpoints: topEndpoints.map((e) => ({ endpoint: e.endpoint, count: e._count.id })),
      failedRequests: errorCount,
      lastUsedKey,
    };
  }

  // ── Public key validation (called by guard) ───────────────────────────────

  async validateApiKey(rawKey: string): Promise<{
    tenantId: string;
    keyId: string;
    keyRecord: { id: string; status: string; tenantId: string };
  } | null> {
    const hash = hashApiKey(rawKey);
    const key = await this.prisma.publicApiKey.findUnique({
      where: { keyHash: hash },
      select: { id: true, status: true, tenantId: true, expiresAt: true },
    });

    if (!key) return null;
    if (key.status !== 'ACTIVE') return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;

    return { tenantId: key.tenantId, keyId: key.id, keyRecord: key };
  }

  async touchLastUsed(keyId: string): Promise<void> {
    await this.prisma.publicApiKey.update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    });
  }

  async getAllowedDomains(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.allowedDomain.findMany({
      where: { tenantId },
      select: { domain: true },
    });
    return rows.map((r) => r.domain);
  }

  async logRequest(data: {
    tenantId: string;
    apiKeyId: string | null;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs: number;
    origin: string | null;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void> {
    const { tenantId, statusCode } = data;

    await Promise.all([
      this.prisma.apiRequestLog.create({ data }),
      this.prisma.apiUsageDaily.upsert({
        where: {
          tenantId_date: {
            tenantId,
            date: new Date(new Date().toISOString().split('T')[0]),
          },
        },
        create: {
          tenantId,
          date: new Date(new Date().toISOString().split('T')[0]),
          requestCount: 1,
          successCount: statusCode < 400 ? 1 : 0,
          errorCount: statusCode >= 400 ? 1 : 0,
        },
        update: {
          requestCount: { increment: 1 },
          successCount: { increment: statusCode < 400 ? 1 : 0 },
          errorCount: { increment: statusCode >= 400 ? 1 : 0 },
        },
      }),
    ]);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async assertTenantAccess(actor: User, tenantId: string): Promise<void> {
    if (actor.isSuperAdmin) return;
    const tu = await this.prisma.tenantUser.findFirst({
      where: { userId: actor.id, tenantId, deletedAt: null, isActive: true },
    });
    if (!tu) throw new ForbiddenException('Bu tenant için erişiminiz yok');
  }

  private async findKey(tenantId: string, keyId: string) {
    const key = await this.prisma.publicApiKey.findFirst({
      where: { id: keyId, tenantId },
    });
    if (!key) throw new NotFoundException('API Key bulunamadı');
    return key;
  }

  private validateDomain(domain: string): void {
    if (domain.includes('*')) throw new BadRequestException('Wildcard domain desteklenmiyor');
    const valid = /^[a-zA-Z0-9._-]+$/.test(domain);
    if (!valid) throw new BadRequestException('Geçersiz domain formatı');
  }
}
