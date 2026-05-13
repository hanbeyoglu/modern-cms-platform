import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, StoreCategory, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { slugify } from '../common/utils/slugify';
import type { CreateStoreCategoryDto } from './dto/create-store-category.dto';
import type { UpdateStoreCategoryDto } from './dto/update-store-category.dto';
import type { ListStoreCategoriesDto } from './dto/list-store-categories.dto';

@Injectable()
export class StoreCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(query: ListStoreCategoriesDto): Promise<{
    items: StoreCategory[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StoreCategoryWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.storeCategory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.storeCategory.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<StoreCategory> {
    const row = await this.prisma.storeCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Store category not found');
    return row;
  }

  async create(dto: CreateStoreCategoryDto, user: User): Promise<StoreCategory> {
    const baseSlug = dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.name);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const row = await this.prisma.storeCategory.create({
      data: {
        name: dto.name.trim(),
        slug,
        icon: dto.icon?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 'ACTIVE',
      },
    });

    await this.audit.logAction({
      userId: user.id,
      action: 'store-category:create',
      entityType: 'store-category',
      entityId: row.id,
      after: { name: row.name, slug: row.slug, status: row.status },
    });

    return row;
  }

  async update(id: string, dto: UpdateStoreCategoryDto, user: User): Promise<StoreCategory> {
    const existing = await this.findOne(id);

    const data: Prisma.StoreCategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) data.status = dto.status;

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

    const row = await this.prisma.storeCategory.update({
      where: { id },
      data,
    });

    await this.audit.logAction({
      userId: user.id,
      action: 'store-category:update',
      entityType: 'store-category',
      entityId: row.id,
      before: { name: existing.name, status: existing.status, slug: existing.slug },
      after: { name: row.name, status: row.status, slug: row.slug },
    });

    return row;
  }

  async remove(id: string, user: User): Promise<void> {
    const existing = await this.findOne(id);

    await this.prisma.storeCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.logAction({
      userId: user.id,
      action: 'store-category:delete',
      entityType: 'store-category',
      entityId: id,
      before: { name: existing.name, slug: existing.slug },
    });
  }

  private async ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
    let slug = base;
    let n = 0;
    while (true) {
      const conflict = await this.prisma.storeCategory.findFirst({
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
