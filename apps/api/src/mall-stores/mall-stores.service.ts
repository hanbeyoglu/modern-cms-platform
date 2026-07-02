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
import { SearchIndexerService } from '../search/search-indexer.service';
import type { AssignMallStoreDto } from './dto/assign-mall-store.dto';
import type { UpdateMallStoreDto } from './dto/update-mall-store.dto';
import type { ListMallStoresDto } from './dto/list-mall-stores.dto';
import { validateWorkingHours } from '../common/types/working-hours';

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
  description: true,
  color: true,
  active: true,
  parentCategoryId: true,
  sortOrder: true,
} as const;

const MALL_STORE_INCLUDE = {
  globalStore: {
    include: {
      logoMedia: { select: MEDIA_SELECT },
    },
  },
  localLogoMedia: { select: MEDIA_SELECT },
  floorRecord: true,
  category: { select: CATEGORY_SELECT },
} satisfies Prisma.MallStoreInclude;

export type MallStoreCategoryPreview = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  active: boolean;
  parentCategoryId: string | null;
  sortOrder: number;
};

export function mapMallStoreCategory(
  row: Prisma.MallStoreGetPayload<{ include: typeof MALL_STORE_INCLUDE }>,
): MallStoreCategoryPreview | null {
  return row.category;
}

export type MallStoreResponse = Prisma.MallStoreGetPayload<{ include: typeof MALL_STORE_INCLUDE }>;

export type PublicMallStore = {
  id: string;
  mallId: string;
  tenantId: string;
  detailTitle: string | null;
  localDescription: string | null;
  floor: string | null;
  floorId: string | null;
  storeNo: string | null;
  phone: string | null;
  whatsappPhone: string | null;
  email: string | null;
  workingHoursJson: Prisma.JsonValue | null;
  locationJson: Prisma.JsonValue | null;
  isFeatured: boolean;
  isSoon: boolean;
  searchTags: string[];
  sortOrder: number;
  category: { id: string; name: string; slug: string } | null;
  globalStore: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    phone: string | null;
    email: string | null;
    websiteUrl: string | null;
    logoMedia: { id: string; publicUrl: string; originalName: string; mimeType: string } | null;
  };
};

@Injectable()
export class MallStoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly access: AccessService,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  private scheduleMallStoreIndex(id: string): void {
    void this.searchIndexer.syncMallStore(id).catch(() => undefined);
  }

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
        ? { categoryId: query.categoryId, category: { is: { deletedAt: null } } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { detailTitle: { contains: query.search, mode: 'insensitive' as const } },
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

    if (dto.workingHoursJson !== undefined) {
      const err = validateWorkingHours(dto.workingHoursJson);
      if (err) throw new BadRequestException(err);
    }

    const floorFields = await this.resolveFloorFields(tenantId, mallId, dto.floorId, dto.floor);

    let categoryId: string | null = null;
    if (dto.categoryId) {
      categoryId = await this.assertCategoryInMall(dto.categoryId, tenantId, mallId);
    }

    const row = await this.prisma.mallStore.create({
      data: {
        tenantId,
        mallId,
        globalStoreId: dto.globalStoreId,
        categoryId,
        detailTitle: dto.detailTitle?.trim() || null,
        localDescription: dto.localDescription?.trim() || null,
        floor: floorFields.floor,
        floorId: floorFields.floorId,
        storeNo: dto.storeNo?.trim() || null,
        phone: dto.phone?.trim() || null,
        whatsappPhone: dto.whatsappPhone?.trim() || null,
        email: dto.email?.trim() || null,
        workingHoursJson:
          dto.workingHoursJson !== undefined
            ? (dto.workingHoursJson as Prisma.InputJsonValue)
            : undefined,
        locationJson:
          dto.locationJson !== undefined ? (dto.locationJson as Prisma.InputJsonValue) : undefined,
        isFeatured: dto.isFeatured ?? false,
        isSoon: dto.isSoon ?? false,
        searchTags: dto.searchTags ?? [],
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
        detailTitle: row.detailTitle,
      },
    });

    this.scheduleMallStoreIndex(row.id);
    return this.findOne(req, user, row.id);
  }

  async update(req: Request, user: User, id: string, dto: UpdateMallStoreDto): Promise<MallStoreResponse> {
    const { tenantId, mallId } = this.resolveScope(req);
    await this.access.assertMallAccess(user, tenantId, mallId);

    const existing = await this.prisma.mallStore.findFirst({
      where: { id, tenantId, mallId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Mall store not found');

    if (dto.workingHoursJson !== undefined && dto.workingHoursJson !== null) {
      const err = validateWorkingHours(dto.workingHoursJson);
      if (err) throw new BadRequestException(err);
    }

    let floorUpdate: Prisma.MallStoreUpdateInput = {};
    if (dto.floorId !== undefined || dto.floor !== undefined) {
      const floorFields = await this.resolveFloorFields(
        tenantId,
        mallId,
        dto.floorId ?? undefined,
        dto.floor ?? undefined,
        true,
      );
      floorUpdate = {
        floor: floorFields.floor,
        floorRecord: floorFields.floorId
          ? { connect: { id: floorFields.floorId } }
          : { disconnect: true },
      };
    }

    const data: Prisma.MallStoreUpdateInput = {
      ...(dto.detailTitle !== undefined && { detailTitle: dto.detailTitle }),
      ...(dto.localDescription !== undefined && { localDescription: dto.localDescription }),
      ...floorUpdate,
      ...(dto.storeNo !== undefined && { storeNo: dto.storeNo }),
      ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
      ...(dto.whatsappPhone !== undefined && { whatsappPhone: dto.whatsappPhone?.trim() || null }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
      ...(dto.isSoon !== undefined && { isSoon: dto.isSoon }),
      ...(dto.searchTags !== undefined && { searchTags: dto.searchTags }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.status !== undefined && { status: dto.status }),
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

    if (dto.categoryId !== undefined) {
      if (dto.categoryId === null || dto.categoryId === '') {
        data.category = { disconnect: true };
      } else {
        const categoryId = await this.assertCategoryInMall(dto.categoryId, tenantId, mallId);
        data.category = { connect: { id: categoryId } };
      }
    }

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
        detailTitle: existing.detailTitle,
        status: existing.status,
        isFeatured: existing.isFeatured,
      },
      after: {
        detailTitle: row.detailTitle,
        status: row.status,
        isFeatured: row.isFeatured,
      },
    });

    this.scheduleMallStoreIndex(id);
    return this.findOne(req, user, id);
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
      before: { globalStoreId: existing.globalStoreId, detailTitle: existing.detailTitle },
    });

    this.scheduleMallStoreIndex(id);
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

    this.scheduleMallStoreIndex(id);
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
        ...(opts.categoryId
          ? { categoryId: opts.categoryId, category: { is: { deletedAt: null, active: true } } }
          : {}),
        globalStore: {
          is: {
            deletedAt: null,
            status: 'ACTIVE',
          },
        },
        ...(opts.search
          ? {
              OR: [
                { detailTitle: { contains: opts.search, mode: 'insensitive' as const } },
                {
                  globalStore: {
                    is: {
                      deletedAt: null,
                      status: 'ACTIVE',
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
        category: { select: { id: true, name: true, slug: true } },
        globalStore: {
          include: {
            logoMedia: { select: MEDIA_SELECT },
          },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { globalStore: { name: 'asc' } }],
    });

    return rows.map((r) => {
      const category = r.category;
      return {
        id: r.id,
        mallId: r.mallId,
        tenantId: r.tenantId,
        detailTitle: r.detailTitle,
        localDescription: r.localDescription,
        floor: r.floor,
        floorId: r.floorId,
        storeNo: r.storeNo,
        phone: r.phone ?? r.globalStore.phone,
        whatsappPhone: r.whatsappPhone,
        email: r.globalStore.email ?? r.email,
        workingHoursJson: r.workingHoursJson,
        locationJson: r.locationJson,
        isFeatured: r.isFeatured,
        isSoon: r.isSoon,
        searchTags: r.searchTags,
        sortOrder: r.sortOrder,
        category,
        globalStore: {
          id: r.globalStore.id,
          name: r.globalStore.name,
          slug: r.globalStore.slug,
          description: r.globalStore.description,
          phone: r.globalStore.phone,
          email: r.globalStore.email,
          websiteUrl: r.globalStore.websiteUrl,
          logoMedia: r.globalStore.logoMedia,
        },
      };
    });
  }

  private async resolveFloorFields(
    tenantId: string,
    mallId: string,
    floorId?: string | null,
    floorText?: string | null,
    allowNull = false,
  ): Promise<{ floorId: string | null; floor: string | null }> {
    if (floorId) {
      const row = await this.prisma.mallFloor.findFirst({
        where: { id: floorId, tenantId, mallId, active: true },
      });
      if (!row) throw new BadRequestException('Geçersiz kat seçimi');
      return { floorId: row.id, floor: row.label };
    }
    const custom = floorText?.trim();
    if (custom) return { floorId: null, floor: custom };
    if (allowNull) return { floorId: null, floor: null };
    return { floorId: null, floor: null };
  }

  private async assertCategoryInMall(
    categoryId: string,
    tenantId: string,
    mallId: string,
  ): Promise<string> {
    const row = await this.prisma.storeCategory.findFirst({
      where: { id: categoryId, tenantId, mallId, deletedAt: null, active: true },
      select: { id: true },
    });
    if (!row) throw new BadRequestException('Geçersiz veya pasif kategori');
    return row.id;
  }
}
