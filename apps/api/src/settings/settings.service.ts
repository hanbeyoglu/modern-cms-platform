import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import type { UpdateGeneralSettingsDto, UpdateSecuritySettingsDto } from './dto/update-settings.dto';

const GENERAL_DEFAULTS = {
  displayName: '',
  timezone: 'Europe/Istanbul',
  defaultLocale: 'tr',
  supportEmail: '',
  logoUrl: '',
};

const SECURITY_DEFAULTS = {
  sessionTimeoutMinutes: 60,
  allowPublicRegistration: false,
  maintenanceMode: false,
  passwordPolicy: 'default',
};

type JsonObject = Record<string, unknown>;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async getSettings(actor: User, tenantId: string) {
    await this.assertAccess(actor, tenantId);

    const rows = await this.prisma.tenantSetting.findMany({ where: { tenantId } });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return {
      tenantId,
      general: { ...GENERAL_DEFAULTS, ...(map.general as JsonObject ?? {}) },
      security: { ...SECURITY_DEFAULTS, ...(map.security as JsonObject ?? {}) },
    };
  }

  async updateGeneralSettings(actor: User, tenantId: string, dto: UpdateGeneralSettingsDto) {
    await this.assertAccess(actor, tenantId);

    const current = await this.getSettings(actor, tenantId);
    const next = { ...current.general, ...dto };

    await this.prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key: 'general' } },
      update: { value: next },
      create: { tenantId, key: 'general', value: next },
    });

    await this.audit.logAction({
      userId: actor.id,
      tenantId,
      action: 'settings_updated',
      entityType: 'tenant_setting',
      entityId: tenantId,
      before: current.general,
      after: next,
    });

    return this.getSettings(actor, tenantId);
  }

  async updateSecuritySettings(actor: User, tenantId: string, dto: UpdateSecuritySettingsDto) {
    await this.assertAccess(actor, tenantId);

    const current = await this.getSettings(actor, tenantId);
    const next = { ...current.security, ...dto };

    await this.prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key: 'security' } },
      update: { value: next },
      create: { tenantId, key: 'security', value: next },
    });

    await this.audit.logAction({
      userId: actor.id,
      tenantId,
      action: 'settings_updated',
      entityType: 'tenant_setting',
      entityId: tenantId,
      before: current.security,
      after: next,
    });

    return this.getSettings(actor, tenantId);
  }

  private async assertAccess(actor: User, tenantId: string): Promise<void> {
    if (actor.isSuperAdmin) {
      const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
      if (!tenant) throw new NotFoundException('Tenant bulunamadı');
      return;
    }

    const tu = await this.prisma.tenantUser.findFirst({
      where: { userId: actor.id, tenantId, deletedAt: null },
    });
    if (!tu) throw new ForbiddenException('Bu tenant için erişim yok');
  }
}
