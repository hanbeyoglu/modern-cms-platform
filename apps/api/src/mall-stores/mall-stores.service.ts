import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { AccessService } from '../access/access.service';
import type { AssignMallStoreDto } from './dto/assign-mall-store.dto';
import type { UpdateMallStoreDto } from './dto/update-mall-store.dto';
import type { ListMallStoresDto } from './dto/list-mall-stores.dto';

const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  originalName: true,
  mimeType: true,
} as const;

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
} as const;

const MALL_STORE_INCLUDE = {
  globalStore: {
    include: {
      logoMedia: { select: MEDIA_SELECT },
      category: { select: CATEGORY_SELECT },
    },
  },
  localLogoMedia: { select: MEDIA_SELECT },
} satisfies Prisma.MallStoreInclude;

export type MallStoreResponse = Prisma.MallStoreGetPayload<{ include: typeof MALL_STORE_INCLUDE }>;

export type PublicMallStore = {
  id: string;
  mallId: string;
  tenantId: string;
  localName: string | null;
  localDescription: string | null;
  floor: string | null;
  storeNo: string | null;
  phone: string | null;
  email: string | null;
  workingHoursJson: Prisma.JsonValue | null;
  locationJson: Prisma.JsonValue | null;
  isFeatured: boolean;
  sortOrder: number;
  globalStore: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    websiteUrl: string | null;
    logoMedia: { id: string; publicUrl: string; originalName: string; mimeType: string } | null;
    category: { id: string; name: string; slug: string } | null;
  };
};

@Injectable()
export class MallStoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly access: AccessService,
  ) {}

  private resolveScope(req: Request): { tenantId: string; mallId: string } {
    const tenantId = req.tenantId;
    const mallId = req.mallId;
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id başlığı gerekli');
    }
    if (!mallId) {
      throw new BadRequestException('x-mall-id başlığı gerekli');
    }
    return { tenantId, mallId };
  }

  async list(
    req: Request,
    user: User,
    query: ListMallStoresDto,
  ): Promise<{ items: MallStoreResponse[]; total: number; page: number; limit: number }> {
    const { tenantId, mallId } = this.resolveScope(req);
    await this.access.assertMallAccess(user, tenantId, mallId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MallStoreWhereInput = {
      tenantId,
      mallId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.isFeatured === true || query.isFeatured === false ? { isFeatured: query.isFeatured } : {}),
      ...(query.categoryId
        ? { globalStore: { is: { categoryId: query.categoryId, deletedAt: null } } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { localName: { contains: query.search, mode: 'insensitive' as const } },
              {
                globalStore: {
                  is: { name: { contains: query.search, mode: 'insensitive' as const }, deletedAt: null },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.mallStore.findMany({
        where,
        include: MALL_STORE_INCLUDE,
        orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.mallStore.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(req: Request, user: User, id: string): Promise<MallStoreResponse> {
    const { tenantId, mallId } = this.resolveScope(req);
    await this.access.assertMallAccess(user, tenantId, mallId);

    const row = await this.prisma.mallStore.findFirst({
      where: { id, tenantId, mallId, deletedAt: null },
      include: MALL_STORE_INCLUDE,
    });
    if (!row) throw new NotFoundException('Mall store not found');
    return row;
  }

  async assign(req: Request, user: User, dto: AssignMallStoreDto): Promise<MallStoreResponse> {
    const { tenantId, mallId } = this.resolveScope(req);
    await this.access.assertMallAccess(user, tenantId, mallId);

    const global = await this.prisma.globalStore.findFirst({
      where: { id: dto.globalStoreId, deletedAt: null },
    });
    if (!global) throw new BadRequestException('Geçersiz globalStoreId');

    const dup = await this.prisma.mallStore.findFirst({
      where: { mallId, globalStoreId: dto.globalStoreId, deletedAt: null },
    });
    if (dup) {
      throw new ConflictException('Bu global mağaza bu AVM için zaten atanmış');
    }

    if (dto.localLogoMediaId) {
      await this.assertTenantMedia(tenantId, dto.localLogoMediaId);
    }

    const row = await this.prisma.mallStore.create({
      data: {
        tenantId,
        mallId,
        globalStoreId: dto.globalStoreId,
        localName: dto.localName?.trim() || null,
        localDescription: dto.localDescription?.trim() || null,
        localLogoMediaId: dto.localLogoMediaId ?? null,
        floor: dto.floor?.trim() || null,
        storeNo: dto.storeNo?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: this.normalizeEmail(dto.email),
        workingHoursJson:
          dto.workingHoursJson !== undefined
            ? (dto.workingHoursJson as Prisma.InputJsonValue)
            : undefined,
        locationJson:
          dto.locationJson !== undefined ? (dto.locationJson as Prisma.InputJsonValue) : undefined,
        isFeatured: dto.isFeatured ?? false,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 'ACTIVE',
        createdBy: user.id,
      },
      include: MALL_STORE_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'mall-store:assign',
      entityType: 'mall-store',
      entityId: row.id,
      after: {
        globalStoreId: dto.globalStoreId,
        mallId,
        localName: row.localName,
      },
    });

    return row;
  }

  async update(req: Request, user: User, id: string, dto: UpdateMallStoreDto): Promise<MallStoreResponse> {
    const { tenantId, mallId } = this.resolveScope(req);
    await this.access.assertMallAccess(user, tenantId, mallId);

    const existing = await this.prisma.mallStore.findFirst({
      where: { id, tenantId, mallId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Mall store not found');

    if (dto.localLogoMediaId !== undefined && dto.localLogoMediaId !== null) {
      await this.assertTenantMedia(tenantId, dto.localLogoMediaId);
    }

    const data: Prisma.MallStoreUpdateInput = {
      ...(dto.localName !== undefined && { localName: dto.localName }),
      ...(dto.localDescription !== undefined && { localDescription: dto.localDescription }),
      ...(dto.floor !== undefined && { floor: dto.floor }),
      ...(dto.storeNo !== undefined && { storeNo: dto.storeNo }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: this.normalizeEmail(dto.email) }),
      ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.localLogoMediaId !== undefined && { localLogoMediaId: dto.localLogoMediaId }),
      ...(dto.workingHoursJson !== undefined && {
        workingHoursJson:
          dto.workingHoursJson === null ? Prisma.JsonNull : (dto.workingHoursJson as Prisma.InputJsonValue),
      }),
      ...(dto.locationJson !== undefined && {
        locationJson:
          dto.locationJson === null ? Prisma.JsonNull : (dto.locationJson as Prisma.InputJsonValue),
      }),
      updatedByUser: { connect: { id: user.id } },
    };

    const row = await this.prisma.mallStore.update({
      where: { id },
      data,
      include: MALL_STORE_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'mall-store:update',
      entityType: 'mall-store',
      entityId: id,
      before: {
        localName: existing.localName,
        status: existing.status,
        isFeatured: existing.isFeatured,
      },
      after: {
        localName: row.localName,
        status: row.status,
        isFeatured: row.isFeatured,
      },
    });

    return row;
  }

  async remove(req: Request, user: User, id: string): Promise<void> {
    const { tenantId, mallId } = this.resolveScope(req);
    await this.access.assertMallAccess(user, tenantId, mallId);

    const existing = await this.prisma.mallStore.findFirst({
      where: { id, tenantId, mallId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Mall store not found');

    await this.prisma.mallStore.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedByUser: { connect: { id: user.id } },
      },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'mall-store:delete',
      entityType: 'mall-store',
      entityId: id,
      before: { globalStoreId: existing.globalStoreId, localName: existing.localName },
    });
  }

  async setFeatured(req: Request, user: User, id: string, featured: boolean): Promise<MallStoreResponse> {
    const { tenantId, mallId } = this.resolveScope(req);
    await this.access.assertMallAccess(user, tenantId, mallId);

    const existing = await this.prisma.mallStore.findFirst({
      where: { id, tenantId, mallId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Mall store not found');

    const row = await this.prisma.mallStore.update({
      where: { id },
      data: { isFeatured: featured, updatedByUser: { connect: { id: user.id } } },
      include: MALL_STORE_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: featured ? 'mall-store:feature' : 'mall-store:unfeature',
      entityType: 'mall-store',
      entityId: id,
      before: { isFeatured: existing.isFeatured },
      after: { isFeatured: featured },
    });

    return row;
  }

  /**
   * Future public site / kiosk: active mall assignments with active global stores only.
   */
  async getPublicMallStores(opts: {
    tenantId: string;
    mallId: string;
    categoryId?: string;
    search?: string;
    featuredOnly?: boolean;
  }): Promise<PublicMallStore[]> {
    const rows = await this.prisma.mallStore.findMany({
      where: {
        tenantId: opts.tenantId,
        mallId: opts.mallId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(opts.featuredOnly ? { isFeatured: true } : {}),
        globalStore: {
          is: {
            deletedAt: null,
            status: 'ACTIVE',
            ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
          },
        },
        ...(opts.search
          ? {
              OR: [
                { localName: { contains: opts.search, mode: 'insensitive' as const } },
                {
                  globalStore: {
                    is: {
                      deletedAt: null,
                      status: 'ACTIVE',
                      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
                      OR: [
                        { name: { contains: opts.search, mode: 'insensitive' as const } },
                        { description: { contains: opts.search, mode: 'insensitive' as const } },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        globalStore: {
          include: {
            logoMedia: { select: MEDIA_SELECT },
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { globalStore: { name: 'asc' } }],
    });

    return rows.map((r) => ({
      id: r.id,
      mallId: r.mallId,
      tenantId: r.tenantId,
      localName: r.localName,
      localDescription: r.localDescription,
      floor: r.floor,
      storeNo: r.storeNo,
      phone: r.phone,
      email: r.email,
      workingHoursJson: r.workingHoursJson,
      locationJson: r.locationJson,
      isFeatured: r.isFeatured,
      sortOrder: r.sortOrder,
      globalStore: {
        id: r.globalStore.id,
        name: r.globalStore.name,
        slug: r.globalStore.slug,
        description: r.globalStore.description,
        websiteUrl: r.globalStore.websiteUrl,
        logoMedia: r.globalStore.logoMedia,
        category: r.globalStore.category,
      },
    }));
  }

  private normalizeEmail(v: string | null | undefined): string | null {
    if (v === undefined || v === null) return null;
    const t = String(v).trim();
    return t.length === 0 ? null : t;
  }

  private async assertTenantMedia(tenantId: string, mediaId: string): Promise<void> {
    const m = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, tenantId, deletedAt: null },
    });
    if (!m) throw new BadRequestException('localLogoMediaId bu tenant için geçerli bir medya olmalıdır');
  }
}
