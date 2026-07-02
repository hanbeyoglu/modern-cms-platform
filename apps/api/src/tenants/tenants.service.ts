import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditSeverity, Prisma, type TenantStatus, type User } from '@prisma/client';
import { AuditLogService } from '../audit/audit.service';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageProvider } from '../media/storage/storage.provider';
import { provisionDefaultLocalesIfMissing } from '../locales/provision-default-locales';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { UpdateTenantDto } from './dto/update-tenant.dto';
import type { ListTenantsDto } from './dto/list-tenants.dto';
import { DeleteTenantDto, TenantDeleteMode } from './dto/delete-tenant.dto';

// Base capabilities enabled when creating a new tenant
const DEFAULT_CAPABILITIES = [
  'cms_core', 'media', 'public_api',
  'sliders', 'pages', 'stores', 'events', 'campaigns',
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditLogService,
    private readonly storage: StorageProvider,
  ) {}

  // Legacy /tenants/my
  async my(user: User) {
    const tenants = await this.access.listTenantsForUser(user);
    if (tenants.length === 0) {
      return { tenants: [] };
    }

    const settings = await this.prisma.tenantSetting.findMany({
      where: {
        tenantId: { in: tenants.map((t) => t.id) },
        key: 'general',
      },
      select: { tenantId: true, value: true },
    });

    const logoUrlByTenant = new Map<string, string | null>();
    for (const row of settings) {
      const value = row.value as Record<string, unknown> | null;
      const logoUrl =
        typeof value?.logoUrl === 'string' && value.logoUrl.trim().length > 0
          ? value.logoUrl.trim()
          : null;
      logoUrlByTenant.set(row.tenantId, logoUrl);
    }

    return {
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        logoUrl: logoUrlByTenant.get(t.id) ?? null,
      })),
    };
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────

  async list(actor: User, query: ListTenantsDto) {
    if (!actor.isSuperAdmin) throw new ForbiddenException('Yalnızca Super Admin tüm tenantları görebilir');

    const where: Prisma.TenantWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status as TenantStatus;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        { legalName: { contains: query.search, mode: 'insensitive' } },
        { contactEmail: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const tenants = await this.prisma.tenant.findMany({
      where,
      include: {
        _count: { select: { malls: true, tenantUsers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { tenants };
  }

  async findOne(actor: User, id: string) {
    if (!actor.isSuperAdmin) {
      await this.access.assertTenantAccess(actor, id);
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      include: {
        malls: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true, type: true, status: true, city: true },
        },
        capabilities: {
          include: { capability: { select: { code: true, name: true, category: true } } },
        },
        _count: { select: { tenantUsers: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant bulunamadı');
    return tenant;
  }

  async create(actor: User, dto: CreateTenantDto) {
    if (!actor.isSuperAdmin) throw new ForbiddenException('Yalnızca Super Admin tenant oluşturabilir');

    const baseSlug = dto.slug || slugify(dto.name);
    const existing = await this.prisma.tenant.findFirst({ where: { slug: baseSlug } });
    if (existing) throw new BadRequestException(`"${baseSlug}" slug zaten kullanımda`);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: baseSlug,
        status: dto.status ?? 'ACTIVE',
        legalName: dto.legalName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        websiteUrl: dto.websiteUrl,
        billingEmail: dto.billingEmail,
        addressJson: dto.addressJson ? (dto.addressJson as object) : undefined,
        metadataJson: dto.metadataJson ? (dto.metadataJson as object) : undefined,
      },
    });

    // Enable default capabilities
    const caps = await this.prisma.capability.findMany({
      where: { code: { in: DEFAULT_CAPABILITIES } },
    });
    if (caps.length > 0) {
      const now = new Date();
      await this.prisma.tenantCapability.createMany({
        data: caps.map((cap) => ({
          tenantId: tenant.id,
          capabilityId: cap.id,
          enabled: true,
          enabledAt: now,
        })),
        skipDuplicates: true,
      });
    }

    await provisionDefaultLocalesIfMissing(this.prisma, tenant.id);

    await this.audit.logAction({
      userId: actor.id,
      tenantId: tenant.id,
      action: 'tenant:create',
      entityType: 'Tenant',
      entityId: tenant.id,
      after: { name: tenant.name, slug: tenant.slug, status: tenant.status },
    });

    return tenant;
  }

  async update(actor: User, id: string, dto: UpdateTenantDto) {
    if (!actor.isSuperAdmin) throw new ForbiddenException('Yalnızca Super Admin tenant güncelleyebilir');

    const existing = await this.prisma.tenant.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Tenant bulunamadı');

    if (dto.slug && dto.slug !== existing.slug) {
      const conflict = await this.prisma.tenant.findFirst({ where: { slug: dto.slug } });
      if (conflict) throw new BadRequestException(`"${dto.slug}" slug zaten kullanımda`);
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.legalName !== undefined && { legalName: dto.legalName }),
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone }),
        ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl }),
        ...(dto.billingEmail !== undefined && { billingEmail: dto.billingEmail }),
        ...(dto.addressJson !== undefined && { addressJson: dto.addressJson as object }),
        ...(dto.metadataJson !== undefined && { metadataJson: dto.metadataJson as object }),
      },
    });

    await this.audit.logAction({
      userId: actor.id,
      tenantId: id,
      action: 'tenant:update',
      entityType: 'Tenant',
      entityId: id,
      before: { name: existing.name, status: existing.status },
      after: { name: updated.name, status: updated.status },
    });

    return updated;
  }

  async updateStatus(actor: User, id: string, status: TenantStatus) {
    if (!actor.isSuperAdmin) throw new ForbiddenException('Yalnızca Super Admin tenant durumu değiştirebilir');

    const existing = await this.prisma.tenant.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Tenant bulunamadı');

    const updated = await this.prisma.tenant.update({ where: { id }, data: { status } });

    const isDeactivation = status === 'ARCHIVED' || status === 'SUSPENDED';
    await this.audit.logAction({
      userId: actor.id,
      tenantId: id,
      action: isDeactivation ? 'tenant:deactivate' : 'tenant:reactivate',
      entityType: 'tenant',
      entityId: id,
      entityName: existing.name,
      severity: isDeactivation ? AuditSeverity.CRITICAL : AuditSeverity.SECURITY,
      before: { status: existing.status },
      after: { status },
    });

    return { success: true, status: updated.status };
  }

  // ── System delete ─────────────────────────────────────────────────────────

  async deletePreview(actor: User, id: string) {
    this.assertSuperAdminDelete(actor);
    const tenant = await this.findTenantForDelete(id);

    const counts = await this.countTenantResources(id);
    const actorMemberships = await this.prisma.tenantUser.findMany({
      where: { userId: actor.id, deletedAt: null },
      select: { tenantId: true },
    });
    const isActorOnlyTenant =
      actorMemberships.length === 1
      && actorMemberships[0]?.tenantId === id;

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        deletedAt: tenant.deletedAt,
      },
      counts,
      isProtected: this.isProtectedTenant(tenant),
      isActorOnlyTenant,
      confirmHint: tenant.slug,
    };
  }

  async delete(actor: User, id: string, dto: DeleteTenantDto) {
    this.assertSuperAdminDelete(actor);
    const tenant = await this.findTenantForDelete(id);

    if (dto.confirmSlug.trim() !== tenant.slug) {
      throw new BadRequestException('Onay için tenant slug eşleşmiyor');
    }
    if (this.isProtectedTenant(tenant)) {
      throw new ForbiddenException('Sistem tenant silinemez');
    }
    if (tenant.deletedAt && dto.mode === TenantDeleteMode.SOFT) {
      throw new BadRequestException('Tenant zaten devre dışı bırakılmış');
    }

    const warnings: string[] = [];
    const beforeCounts = await this.countTenantResources(id);

    if (dto.mode === TenantDeleteMode.SOFT) {
      await this.softDeleteTenant(actor, tenant, beforeCounts);
      return {
        mode: TenantDeleteMode.SOFT,
        tenantId: id,
        deleted: beforeCounts,
        deletedMediaCount: 0,
        failedMediaDeletes: 0,
        warnings,
      };
    }

    const mediaResult = await this.deleteTenantMediaFromStorage(id, warnings);
    const deleted = await this.hardDeleteTenant(actor, tenant, beforeCounts);

    return {
      mode: TenantDeleteMode.HARD,
      tenantId: id,
      deleted,
      deletedMediaCount: mediaResult.deletedMediaCount,
      failedMediaDeletes: mediaResult.failedMediaDeletes,
      warnings,
    };
  }

  private assertSuperAdminDelete(actor: User) {
    if (!actor.isSuperAdmin) {
      throw new ForbiddenException('Yalnızca Super Admin tenant silebilir');
    }
  }

  private async findTenantForDelete(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant bulunamadı');
    return tenant;
  }

  private isProtectedTenant(tenant: { slug: string; metadataJson: unknown }): boolean {
    const protectedSlugs = (process.env.PROTECTED_TENANT_SLUGS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (protectedSlugs.includes(tenant.slug)) return true;

    const meta = tenant.metadataJson as Record<string, unknown> | null;
    return meta?.isSystemTenant === true || meta?.protected === true;
  }

  private async countTenantResources(tenantId: string) {
    const [
      malls,
      users,
      mallStores,
      campaigns,
      events,
      media,
      movies,
      movieSessions,
      screeningHalls,
      sliders,
      popups,
      pages,
      services,
      storeCategories,
      mallFloors,
      locales,
      localizedContent,
      searchIndexEntries,
      notifications,
      movieSyncLogs,
      cinemas,
      movieCategories,
      pageBlocks,
      pageAttachments,
      analyticsEvents,
      tenantSettings,
      tenantCapabilities,
    ] = await Promise.all([
      this.prisma.mall.count({ where: { tenantId } }),
      this.prisma.tenantUser.count({ where: { tenantId } }),
      this.prisma.mallStore.count({ where: { tenantId } }),
      this.prisma.campaign.count({ where: { tenantId } }),
      this.prisma.event.count({ where: { tenantId } }),
      this.prisma.mediaAsset.count({ where: { tenantId } }),
      this.prisma.movie.count({ where: { tenantId } }),
      this.prisma.movieSession.count({ where: { tenantId } }),
      this.prisma.screeningHall.count({ where: { tenantId } }),
      this.prisma.slider.count({ where: { tenantId } }),
      this.prisma.popup.count({ where: { tenantId } }),
      this.prisma.page.count({ where: { tenantId } }),
      this.prisma.service.count({ where: { tenantId } }),
      this.prisma.storeCategory.count({ where: { tenantId } }),
      this.prisma.mallFloor.count({ where: { tenantId } }),
      this.prisma.locale.count({ where: { tenantId } }),
      this.prisma.localizedContent.count({ where: { tenantId } }),
      this.prisma.searchIndexEntry.count({ where: { tenantId } }),
      this.prisma.notification.count({ where: { tenantId } }),
      this.prisma.movieSyncLog.count({ where: { tenantId } }),
      this.prisma.cinema.count({ where: { tenantId } }),
      this.prisma.movieCategory.count({ where: { tenantId } }),
      this.prisma.pageBlock.count({ where: { tenantId } }),
      this.prisma.pageAttachment.count({ where: { tenantId } }),
      this.prisma.analyticsEvent.count({ where: { tenantId } }),
      this.prisma.tenantSetting.count({ where: { tenantId } }),
      this.prisma.tenantCapability.count({ where: { tenantId } }),
    ]);

    return {
      malls,
      users,
      mallStores,
      campaigns,
      events,
      media,
      movies,
      movieSessions,
      screeningHalls,
      sliders,
      popups,
      pages,
      services,
      storeCategories,
      mallFloors,
      locales,
      localizedContent,
      searchIndexEntries,
      notifications,
      movieSyncLogs,
      cinemas,
      movieCategories,
      pageBlocks,
      pageAttachments,
      analyticsEvents,
      tenantSettings,
      tenantCapabilities,
    };
  }

  private async softDeleteTenant(
    actor: User,
    tenant: { id: string; name: string; slug: string; status: TenantStatus },
    counts: Record<string, number>,
  ) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { status: 'ARCHIVED', deletedAt: now },
      });
      await tx.tenantUser.updateMany({
        where: { tenantId: tenant.id, deletedAt: null },
        data: { isActive: false, deletedAt: now },
      });
    });

    const memberUserIds = await this.prisma.tenantUser.findMany({
      where: { tenantId: tenant.id },
      select: { userId: true },
    });
    if (memberUserIds.length > 0) {
      await this.prisma.refreshToken.updateMany({
        where: {
          userId: { in: memberUserIds.map((m) => m.userId) },
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
    }

    await this.audit.logAction({
      userId: actor.id,
      tenantId: tenant.id,
      action: 'tenant:delete',
      entityType: 'Tenant',
      entityId: tenant.id,
      entityName: tenant.name,
      severity: AuditSeverity.CRITICAL,
      before: { status: tenant.status, slug: tenant.slug, counts },
      after: { mode: TenantDeleteMode.SOFT, status: 'ARCHIVED', deletedAt: now.toISOString() },
    });
  }

  private async deleteTenantMediaFromStorage(tenantId: string, warnings: string[]) {
    const assets = await this.prisma.mediaAsset.findMany({
      where: { tenantId },
      select: { storageKey: true },
    });
    const keys = [...new Set(assets.map((a) => a.storageKey).filter(Boolean))];
    let deletedMediaCount = 0;
    let failedMediaDeletes = 0;

    for (const key of keys) {
      try {
        await this.storage.delete(key);
        deletedMediaCount += 1;
      } catch (err) {
        failedMediaDeletes += 1;
        warnings.push(`R2 silme başarısız: ${key}`);
        console.error(`Tenant media delete failed for key ${key}:`, err);
      }
    }

    return { deletedMediaCount, failedMediaDeletes };
  }

  private async hardDeleteTenant(
    actor: User,
    tenant: { id: string; name: string; slug: string; status: TenantStatus },
    counts: Record<string, number>,
  ) {
    await this.prisma.$transaction(async (tx) => {
      // Explicit cleanup for join/child tables that may block cascade
      await tx.searchIndexEntry.deleteMany({ where: { tenantId: tenant.id } });
      await tx.analyticsEvent.deleteMany({ where: { tenantId: tenant.id } });
      await tx.notification.deleteMany({ where: { tenantId: tenant.id } });
      await tx.movieSession.deleteMany({ where: { tenantId: tenant.id } });
      await tx.pageAttachment.deleteMany({ where: { tenantId: tenant.id } });
      await tx.pageBlock.deleteMany({ where: { tenantId: tenant.id } });
      await tx.localizedContent.deleteMany({ where: { tenantId: tenant.id } });
      await tx.tenant.delete({ where: { id: tenant.id } });
    });

    await this.audit.logAction({
      userId: actor.id,
      action: 'tenant:delete',
      entityType: 'Tenant',
      entityId: tenant.id,
      entityName: tenant.name,
      severity: AuditSeverity.CRITICAL,
      before: { status: tenant.status, slug: tenant.slug, counts },
      after: { mode: TenantDeleteMode.HARD, deleted: true },
    });

    return counts;
  }
}
