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
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { UpdateTenantDto } from './dto/update-tenant.dto';
import type { ListTenantsDto } from './dto/list-tenants.dto';

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
}
