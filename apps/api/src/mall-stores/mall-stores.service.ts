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
    },
  },
  localLogoMedia: { select: MEDIA_SELECT },
  categoryLinks: {
    include: {
      storeCategory: { select: CATEGORY_SELECT },
    },
    orderBy: { storeCategory: { sortOrder: 'asc' as const } },
  },
} satisfies Prisma.MallStoreInclude;

export type MallStoreCategoryLink = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export function mapMallStoreCategories(
  row: Prisma.MallStoreGetPayload<{ include: typeof MALL_STORE_INCLUDE }>,
): MallStoreCategoryLink[] {
  return row.categoryLinks.map((link) => link.storeCategory);
}

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
  isSoon: boolean;
  searchTags: string[];
  sortOrder: number;
  categories: { id: string; name: string; slug: string }[];
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
        ? {
            categoryLinks: {
              some: { storeCategoryId: query.categoryId, storeCategory: { deletedAt: null } },
            },
          }
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

    const row = await this.prisma.mallStore.create({
      data: {
        tenantId,
        mallId,
        globalStoreId: dto.globalStoreId,
        localName: dto.localName?.trim() || null,
        localDescription: dto.localDescription?.trim() || null,
        floor: dto.floor?.trim() || null,
        storeNo: dto.storeNo?.trim() || null,
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
        localName: row.localName,
      },
    });

    if (dto.categoryIds !== undefined) {
      await this.syncMallStoreCategories(row.id, dto.categoryIds);
    }

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

    const data: Prisma.MallStoreUpdateInput = {
      ...(dto.localName !== undefined && { localName: dto.localName }),
      ...(dto.localDescription !== undefined && { localDescription: dto.localDescription }),
      ...(dto.floor !== undefined && { floor: dto.floor }),
      ...(dto.storeNo !== undefined && { storeNo: dto.storeNo }),
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

    if (dto.categoryIds !== undefined) {
      await this.syncMallStoreCategories(id, dto.categoryIds);
    }

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
      before: { globalStoreId: existing.globalStoreId, localName: existing.localName },
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
          ? {
              categoryLinks: {
                some: { storeCategoryId: opts.categoryId, storeCategory: { deletedAt: null } },
              },
            }
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
                { localName: { contains: opts.search, mode: 'insensitive' as const } },
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
        categoryLinks: {
          include: {
            storeCategory: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { storeCategory: { sortOrder: 'asc' } },
        },
        globalStore: {
          include: {
            logoMedia: { select: MEDIA_SELECT },
          },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { globalStore: { name: 'asc' } }],
    });

    return rows.map((r) => {
      const categories = r.categoryLinks.map((link) => link.storeCategory);
      return {
        id: r.id,
        mallId: r.mallId,
        tenantId: r.tenantId,
        localName: r.localName,
        localDescription: r.localDescription,
        floor: r.floor,
        storeNo: r.storeNo,
        phone: r.globalStore.phone ?? r.phone,
        email: r.globalStore.email ?? r.email,
        workingHoursJson: r.workingHoursJson,
        locationJson: r.locationJson,
        isFeatured: r.isFeatured,
        isSoon: r.isSoon,
        searchTags: r.searchTags,
        sortOrder: r.sortOrder,
        categories,
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

  private async syncMallStoreCategories(mallStoreId: string, categoryIds: string[]): Promise<void> {
    const unique = [...new Set(categoryIds)];
    if (unique.length === 0) {
      await this.prisma.mallStoreOnCategory.deleteMany({ where: { mallStoreId } });
      return;
    }

    const rows = await this.prisma.storeCategory.findMany({
      where: { id: { in: unique }, deletedAt: null },
      select: { id: true },
    });
    if (rows.length !== unique.length) {
      throw new BadRequestException('Geçersiz veya silinmiş kategori kimliği');
    }

    await this.prisma.$transaction([
      this.prisma.mallStoreOnCategory.deleteMany({ where: { mallStoreId } }),
      this.prisma.mallStoreOnCategory.createMany({
        data: unique.map((storeCategoryId) => ({ mallStoreId, storeCategoryId })),
      }),
    ]);
  }

}
