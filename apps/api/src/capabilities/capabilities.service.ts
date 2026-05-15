import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditSeverity, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import type { UpdateTenantCapabilitiesDto } from './dto/update-tenant-capabilities.dto';

@Injectable()
export class CapabilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async listAll() {
    const caps = await this.prisma.capability.findMany({
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
    return { capabilities: caps };
  }

  async listForTenant(user: User, tenantId: string) {
    if (!user.isSuperAdmin) {
      const tu = await this.prisma.tenantUser.findFirst({
        where: { userId: user.id, tenantId, deletedAt: null },
      });
      if (!tu) throw new ForbiddenException('Bu tenant için erişim yok');
    }

    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!tenant) throw new NotFoundException('Tenant bulunamadı');

    const all = await this.prisma.capability.findMany({
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
    const enabled = await this.prisma.tenantCapability.findMany({
      where: { tenantId },
      select: { capabilityId: true, enabled: true, enabledAt: true, disabledAt: true },
    });
    const enabledMap = new Map(enabled.map((e) => [e.capabilityId, e]));

    return {
      tenantId,
      capabilities: all.map((cap) => {
        const tc = enabledMap.get(cap.id);
        return {
          id: cap.id,
          code: cap.code,
          name: cap.name,
          description: cap.description,
          category: cap.category,
          isSystem: cap.isSystem,
          enabled: tc ? tc.enabled : false,
          enabledAt: tc?.enabledAt ?? null,
          disabledAt: tc?.disabledAt ?? null,
        };
      }),
    };
  }

  async updateTenantCapabilities(
    user: User,
    tenantId: string,
    dto: UpdateTenantCapabilitiesDto,
  ) {
    if (!user.isSuperAdmin) {
      throw new ForbiddenException('Yalnızca Super Admin tenant yeteneklerini güncelleyebilir');
    }

    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!tenant) throw new NotFoundException('Tenant bulunamadı');

    const codes = dto.capabilities.map((c) => c.code);
    const caps = await this.prisma.capability.findMany({ where: { code: { in: codes } } });
    const capByCode = new Map(caps.map((c) => [c.code, c]));

    const now = new Date();
    await Promise.all(
      dto.capabilities.map(async ({ code, enabled }) => {
        const cap = capByCode.get(code);
        if (!cap) return;

        await this.prisma.tenantCapability.upsert({
          where: { tenantId_capabilityId: { tenantId, capabilityId: cap.id } },
          update: {
            enabled,
            enabledAt: enabled ? now : undefined,
            disabledAt: enabled ? undefined : now,
            updatedAt: now,
          },
          create: {
            tenantId,
            capabilityId: cap.id,
            enabled,
            enabledAt: enabled ? now : null,
            disabledAt: enabled ? null : now,
          },
        });
      }),
    );

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'capability_updated',
      entityType: 'tenant_capability',
      entityId: tenantId,
      entityName: tenant.name,
      severity: AuditSeverity.SECURITY,
      after: { changes: dto.capabilities },
    });

    return this.listForTenant(user, tenantId);
  }

  async getEnabledCodesForTenant(tenantId: string): Promise<Set<string>> {
    const rows = await this.prisma.tenantCapability.findMany({
      where: { tenantId, enabled: true },
      include: { capability: { select: { code: true } } },
    });
    return new Set(rows.map((r) => r.capability.code));
  }
}
