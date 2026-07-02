import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditSeverity, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isAuditEnabled } from '../common/utils/audit-enabled.util';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

export interface AuditLogPayload {
  userId?: string;
  tenantId?: string;
  mallId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  severity?: AuditSeverity;
  source?: string;
  success?: boolean;
  correlationId?: string;
  requestId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  extra?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.enabled = isAuditEnabled(config);
  }

  async logAction(payload: AuditLogPayload): Promise<void> {
    // Audit logging is temporarily disabled for MVP/demo deployments.
    // Enterprise customers can enable it through AUDIT_ENABLED.
    if (!this.enabled) return;

    const {
      userId, tenantId, mallId, action, entityType, entityId, entityName,
      severity, source, success, correlationId, requestId,
      before, after, ip, userAgent, extra,
    } = payload;

    const metadata: Record<string, unknown> = {};
    if (before !== undefined) metadata.before = before;
    if (after !== undefined) metadata.after = after;
    if (ip) metadata.ip = ip;
    if (userAgent) metadata.userAgent = userAgent;
    if (extra) Object.assign(metadata, extra);

    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: userId ?? null,
          tenantId: tenantId ?? null,
          mallId: mallId ?? null,
          action,
          resource: entityType,
          resourceId: entityId ?? null,
          resourceName: entityName ?? null,
          severity: severity ?? AuditSeverity.INFO,
          source: source ?? 'api',
          success: success !== false,
          correlationId: correlationId ?? null,
          requestId: requestId ?? null,
          metadata:
            Object.keys(metadata).length > 0
              ? (metadata as Prisma.InputJsonValue)
              : undefined,
        },
      });
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }

  async list(actor: { isSuperAdmin: boolean; id: string }, query: ListAuditLogsDto, scopedTenantId?: string | null) {
    const {
      page = 1, limit = 50,
      tenantId, mallId, actorId, resource, action,
      severity, success, dateFrom, dateTo, search, correlationId,
    } = query;

    const where: Prisma.AuditLogWhereInput = {};

    // RBAC scoping
    if (!actor.isSuperAdmin && scopedTenantId) {
      where.tenantId = scopedTenantId;
    } else if (tenantId) {
      where.tenantId = tenantId;
    }

    if (mallId) where.mallId = mallId;
    if (actorId) where.actorUserId = actorId;
    if (resource) where.resource = resource;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (severity) where.severity = severity as AuditSeverity;
    if (success !== undefined) where.success = success;
    if (correlationId) where.correlationId = correlationId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { resourceName: { contains: search, mode: 'insensitive' } },
        { resourceId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, email: true, firstName: true, lastName: true } },
          tenant: { select: { id: true, name: true, slug: true } },
          mall: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, actor: { isSuperAdmin: boolean }, scopedTenantId?: string | null) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true } },
        tenant: { select: { id: true, name: true, slug: true } },
        mall: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!log) return null;

    if (!actor.isSuperAdmin && scopedTenantId && log.tenantId !== scopedTenantId) {
      return null;
    }

    return log;
  }

  async timeline(entityType: string, entityId: string, actor: { isSuperAdmin: boolean }, scopedTenantId?: string | null) {
    const where: Prisma.AuditLogWhereInput = {
      resource: entityType,
      resourceId: entityId,
    };

    if (!actor.isSuperAdmin && scopedTenantId) {
      where.tenantId = scopedTenantId;
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async exportCsv(actor: { isSuperAdmin: boolean; id: string }, query: ListAuditLogsDto, scopedTenantId?: string | null): Promise<string> {
    const data = await this.list(actor, { ...query, limit: 5000 }, scopedTenantId);

    const headers = ['id', 'timestamp', 'actor', 'tenant', 'mall', 'action', 'resource', 'resourceId', 'resourceName', 'severity', 'source', 'success', 'correlationId', 'requestId'];
    const rows = data.items.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      (log as any).actor ? `${(log as any).actor.email}` : log.actorUserId ?? '',
      (log as any).tenant ? `${(log as any).tenant.name}` : log.tenantId ?? '',
      (log as any).mall ? `${(log as any).mall.name}` : log.mallId ?? '',
      log.action,
      log.resource,
      log.resourceId ?? '',
      log.resourceName ?? '',
      log.severity,
      log.source ?? '',
      String(log.success),
      log.correlationId ?? '',
      log.requestId ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  async exportJson(actor: { isSuperAdmin: boolean; id: string }, query: ListAuditLogsDto, scopedTenantId?: string | null): Promise<object> {
    return this.list(actor, { ...query, limit: 5000 }, scopedTenantId);
  }

  async recentActivity(tenantId?: string, limit = 10) {
    return this.prisma.auditLog.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async securityEvents(tenantId?: string, limit = 10) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        severity: { in: [AuditSeverity.SECURITY, AuditSeverity.CRITICAL] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }
}
