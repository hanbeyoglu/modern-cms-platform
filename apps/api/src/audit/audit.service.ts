import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogPayload {
  userId?: string;
  tenantId?: string;
  mallId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logAction(payload: AuditLogPayload): Promise<void> {
    const { userId, tenantId, mallId, action, entityType, entityId, before, after, ip, userAgent } =
      payload;

    const metadata: Record<string, unknown> = {};
    if (before !== undefined) metadata.before = before;
    if (after !== undefined) metadata.after = after;
    if (ip) metadata.ip = ip;
    if (userAgent) metadata.userAgent = userAgent;

    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: userId ?? null,
          tenantId: tenantId ?? null,
          mallId: mallId ?? null,
          action,
          resource: entityType,
          resourceId: entityId ?? null,
          metadata:
            Object.keys(metadata).length > 0
              ? (metadata as Prisma.InputJsonValue)
              : undefined,
        },
      });
    } catch (err) {
      // Audit failures must never crash the application
      this.logger.error('Failed to write audit log', err);
    }
  }
}
