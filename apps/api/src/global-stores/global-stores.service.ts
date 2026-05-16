import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { SearchIndexerService } from '../search/search-indexer.service';
import { slugify } from '../common/utils/slugify';
import type { CreateGlobalStoreDto } from './dto/create-global-store.dto';
import type { UpdateGlobalStoreDto } from './dto/update-global-store.dto';
import type { ListGlobalStoresDto } from './dto/list-global-stores.dto';

const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  originalName: true,
  mimeType: true,
} as const;

const GLOBAL_STORE_INCLUDE = {
  logoMedia: { select: MEDIA_SELECT },
} satisfies Prisma.GlobalStoreInclude;

export type GlobalStoreResponse = Prisma.GlobalStoreGetPayload<{ include: typeof GLOBAL_STORE_INCLUDE }>;

@Injectable()
export class GlobalStoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  private scheduleGlobalStoreIndex(id: string): void {
    void this.searchIndexer.syncGlobalStore(id).catch(() => undefined);
  }

  async list(query: ListGlobalStoresDto): Promise<{
    items: GlobalStoreResponse[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.GlobalStoreWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.globalStore.findMany({
        where,
        include: GLOBAL_STORE_INCLUDE,
        orderBy: [{ name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.globalStore.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<GlobalStoreResponse> {
    const row = await this.prisma.globalStore.findFirst({
      where: { id, deletedAt: null },
      include: GLOBAL_STORE_INCLUDE,
    });
    if (!row) throw new NotFoundException('Global store not found');
    return row;
  }

  async create(dto: CreateGlobalStoreDto, user: User): Promise<GlobalStoreResponse> {
    if (dto.logoMediaId) {
      await this.assertMediaExists(dto.logoMediaId);
    }

    const baseSlug = dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.name);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const row = await this.prisma.globalStore.create({
      data: {
        name: dto.name.trim(),
        slug,
        ...this.buildLogoMediaCreateInput(dto.logoMediaId),
        description: dto.description?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: this.normalizeEmail(dto.email),
        websiteUrl: dto.websiteUrl?.trim() || null,
        socialLinksJson:
          dto.socialLinksJson !== undefined
            ? (dto.socialLinksJson as Prisma.InputJsonValue)
            : undefined,
        status: dto.status ?? 'ACTIVE',
        createdByUser: { connect: { id: user.id } },
      },
      include: GLOBAL_STORE_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      action: 'global-store:create',
      entityType: 'global-store',
      entityId: row.id,
      after: { name: row.name, slug: row.slug, status: row.status },
    });

    this.scheduleGlobalStoreIndex(row.id);
    return row;
  }

  async update(id: string, dto: UpdateGlobalStoreDto, user: User): Promise<GlobalStoreResponse> {
    const existing = await this.prisma.globalStore.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Global store not found');

    if (dto.logoMediaId !== undefined && dto.logoMediaId !== null) {
      await this.assertMediaExists(dto.logoMediaId);
    }

    const data: Prisma.GlobalStoreUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
      ...(dto.email !== undefined && { email: this.normalizeEmail(dto.email) }),
      ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl }),
      ...(dto.socialLinksJson !== undefined && {
        socialLinksJson:
          dto.socialLinksJson === null ? Prisma.JsonNull : (dto.socialLinksJson as Prisma.InputJsonValue),
      }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...this.buildLogoMediaUpdateInput(dto.logoMediaId),
      updatedByUser: { connect: { id: user.id } },
    };

    if (dto.slug !== undefined && dto.slug !== null && String(dto.slug).trim().length > 0) {
      const candidate = slugify(String(dto.slug));
      if (candidate !== existing.slug) {
        data.slug = await this.ensureUniqueSlug(candidate, existing.id);
      }
    } else if (dto.name !== undefined) {
      const candidate = slugify(dto.name);
      if (candidate !== existing.slug) {
        data.slug = await this.ensureUniqueSlug(candidate, existing.id);
      }
    }

    const row = await this.prisma.globalStore.update({
      where: { id },
      data,
      include: GLOBAL_STORE_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      action: 'global-store:update',
      entityType: 'global-store',
      entityId: row.id,
      before: { name: existing.name, slug: existing.slug, status: existing.status },
      after: { name: row.name, slug: row.slug, status: row.status },
    });

    this.scheduleGlobalStoreIndex(id);
    return row;
  }

  async remove(id: string, user: User): Promise<void> {
    const existing = await this.prisma.globalStore.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Global store not found');

    await this.prisma.globalStore.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedByUser: { connect: { id: user.id } },
      },
    });

    await this.audit.logAction({
      userId: user.id,
      action: 'global-store:delete',
      entityType: 'global-store',
      entityId: id,
      before: { name: existing.name, slug: existing.slug },
    });

    this.scheduleGlobalStoreIndex(id);
  }

  private normalizeEmail(v: string | null | undefined): string | null {
    if (v === undefined || v === null) return null;
    const t = String(v).trim();
    return t.length === 0 ? null : t;
  }

  private buildLogoMediaCreateInput(
    logoMediaId?: string,
  ): Pick<Prisma.GlobalStoreCreateInput, 'logoMedia'> | Record<string, never> {
    if (!logoMediaId) return {};
    return { logoMedia: { connect: { id: logoMediaId } } };
  }

  private buildLogoMediaUpdateInput(
    logoMediaId: string | null | undefined,
  ): Pick<Prisma.GlobalStoreUpdateInput, 'logoMedia'> | Record<string, never> {
    if (logoMediaId === undefined) return {};
    if (logoMediaId === null) return { logoMedia: { disconnect: true } };
    return { logoMedia: { connect: { id: logoMediaId } } };
  }

  private async assertMediaExists(mediaId: string): Promise<void> {
    const m = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    if (!m) throw new BadRequestException('Invalid logoMediaId');
  }

  private async ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
    let slug = base;
    let n = 0;
    while (true) {
      const conflict = await this.prisma.globalStore.findFirst({
        where: {
          slug,
          deletedAt: null,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
      });
      if (!conflict) return slug;
      n += 1;
      slug = `${base}-${n}`;
      if (n > 50) throw new ConflictException('Could not allocate unique slug');
    }
  }
}
