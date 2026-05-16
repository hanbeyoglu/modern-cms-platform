import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type LocationType, type MallStatus, type User } from '@prisma/client';
import { AuditLogService } from '../audit/audit.service';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLocationDto } from './dto/create-location.dto';
import type { UpdateLocationDto } from './dto/update-location.dto';
import type { ListLocationsDto } from './dto/list-locations.dto';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class MallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditLogService,
  ) {}

  // ── Legacy: /malls/my ─────────────────────────────────────────────────────

  async my(user: User, tenantId?: string) {
    const malls = await this.access.listMallsForUser(user, tenantId);
    if (malls.length === 0) {
      return { malls: [] };
    }

    const rows = await this.prisma.mall.findMany({
      where: { id: { in: malls.map((m) => m.id) }, deletedAt: null },
      include: {
        logoMedia: { select: { id: true, publicUrl: true } },
        coverMedia: { select: { id: true, publicUrl: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      malls: rows.map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        name: m.name,
        slug: m.slug,
        status: m.status,
        type: m.type,
        logoMedia: m.logoMedia
          ? { id: m.logoMedia.id, publicUrl: m.logoMedia.publicUrl }
          : null,
        coverMedia: m.coverMedia
          ? { id: m.coverMedia.id, publicUrl: m.coverMedia.publicUrl }
          : null,
      })),
    };
  }

  // ── Location CRUD ─────────────────────────────────────────────────────────

  async list(actor: User, query: ListLocationsDto) {
    const where: Prisma.MallWhereInput = { deletedAt: null };

    if (!actor.isSuperAdmin) {
      const tenantUsers = await this.prisma.tenantUser.findMany({
        where: { userId: actor.id, deletedAt: null },
        select: { tenantId: true },
      });
      const tenantIds = tenantUsers.map((tu) => tu.tenantId);
      if (query.tenantId && !tenantIds.includes(query.tenantId)) {
        throw new ForbiddenException('Bu tenant için erişim yok');
      }
      where.tenantId = query.tenantId || { in: tenantIds };
    } else if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.type) where.type = query.type as LocationType;
    if (query.status) where.status = query.status as MallStatus;
    if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { legalName: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const locations = await this.prisma.mall.findMany({
      where,
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        logoMedia: { select: { id: true, publicUrl: true } },
        coverMedia: { select: { id: true, publicUrl: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return { locations };
  }

  async findOne(actor: User, id: string) {
    const location = await this.prisma.mall.findFirst({
      where: { id, deletedAt: null },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        logoMedia: { select: { id: true, publicUrl: true, originalName: true } },
        coverMedia: { select: { id: true, publicUrl: true, originalName: true } },
      },
    });
    if (!location) throw new NotFoundException('Lokasyon bulunamadı');
    if (!actor.isSuperAdmin) {
      await this.access.assertTenantAccess(actor, location.tenantId);
    }
    return location;
  }

  async create(actor: User, dto: CreateLocationDto) {
    const tenantId = dto.tenantId ?? undefined;
    if (!tenantId) throw new BadRequestException('tenantId gerekli');
    if (!actor.isSuperAdmin) {
      await this.access.assertTenantAccess(actor, tenantId);
    } else {
      const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
      if (!tenant) throw new NotFoundException('Tenant bulunamadı');
    }

    const baseSlug = dto.slug || slugify(dto.name);
    let slug = baseSlug;
    let attempts = 0;
    while (true) {
      const conflict = await this.prisma.mall.findFirst({
        where: { tenantId, slug, deletedAt: null },
      });
      if (!conflict) break;
      attempts++;
      slug = `${baseSlug}-${attempts}`;
    }

    const location = await this.prisma.mall.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        type: dto.type ?? 'SHOPPING_MALL',
        status: 'LIVE',
        isPublic: dto.isPublic ?? true,
        legalName: dto.legalName,
        displayName: dto.displayName,
        shortDescription: dto.shortDescription,
        description: dto.description,
        logoMediaId: dto.logoMediaId,
        coverMediaId: dto.coverMediaId,
        websiteUrl: dto.websiteUrl,
        supportEmail: dto.supportEmail,
        phone: dto.phone,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        district: dto.district,
        country: dto.country,
        postalCode: dto.postalCode,
        latitude: dto.latitude,
        longitude: dto.longitude,
        timezone: dto.timezone,
        workingHoursJson: dto.workingHoursJson ? (dto.workingHoursJson as object) : undefined,
        socialLinksJson: dto.socialLinksJson ? (dto.socialLinksJson as object) : undefined,
        metadataJson: dto.metadataJson ? (dto.metadataJson as object) : undefined,
      },
    });

    await this.audit.logAction({
      userId: actor.id,
      tenantId,
      action: 'location:create',
      entityType: 'Location',
      entityId: location.id,
      after: { name: location.name, slug: location.slug, type: location.type },
    });

    return location;
  }

  async update(actor: User, id: string, dto: UpdateLocationDto) {
    const existing = await this.prisma.mall.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Lokasyon bulunamadı');
    if (!actor.isSuperAdmin) {
      await this.access.assertTenantAccess(actor, existing.tenantId);
    }

    const updated = await this.prisma.mall.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
        ...(dto.legalName !== undefined && { legalName: dto.legalName }),
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.shortDescription !== undefined && { shortDescription: dto.shortDescription }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.logoMediaId !== undefined && { logoMediaId: dto.logoMediaId }),
        ...(dto.coverMediaId !== undefined && { coverMediaId: dto.coverMediaId }),
        ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl }),
        ...(dto.supportEmail !== undefined && { supportEmail: dto.supportEmail }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.addressLine1 !== undefined && { addressLine1: dto.addressLine1 }),
        ...(dto.addressLine2 !== undefined && { addressLine2: dto.addressLine2 }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.district !== undefined && { district: dto.district }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.workingHoursJson !== undefined && { workingHoursJson: dto.workingHoursJson as object }),
        ...(dto.socialLinksJson !== undefined && { socialLinksJson: dto.socialLinksJson as object }),
        ...(dto.metadataJson !== undefined && { metadataJson: dto.metadataJson as object }),
      },
    });

    await this.audit.logAction({
      userId: actor.id,
      tenantId: existing.tenantId,
      mallId: id,
      action: 'location:update',
      entityType: 'Location',
      entityId: id,
      before: { name: existing.name, status: existing.status },
      after: { name: updated.name, status: updated.status },
    });

    return updated;
  }

  async updateStatus(actor: User, id: string, status: MallStatus) {
    const existing = await this.prisma.mall.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Lokasyon bulunamadı');
    if (!actor.isSuperAdmin) {
      await this.access.assertTenantAccess(actor, existing.tenantId);
    }

    const updated = await this.prisma.mall.update({
      where: { id },
      data: { status },
    });

    await this.audit.logAction({
      userId: actor.id,
      tenantId: existing.tenantId,
      mallId: id,
      action: status === 'CLOSED' ? 'location:deactivate' : 'location:update',
      entityType: 'Location',
      entityId: id,
      before: { status: existing.status },
      after: { status },
    });

    return { success: true, status: updated.status };
  }

  async remove(actor: User, id: string) {
    const existing = await this.prisma.mall.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Lokasyon bulunamadı');
    if (!actor.isSuperAdmin) {
      await this.access.assertTenantAccess(actor, existing.tenantId);
    }

    await this.prisma.mall.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.logAction({
      userId: actor.id,
      tenantId: existing.tenantId,
      mallId: id,
      action: 'location:delete',
      entityType: 'Location',
      entityId: id,
      before: { name: existing.name },
    });

    return { success: true };
  }
}
