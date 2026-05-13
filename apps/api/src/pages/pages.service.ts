import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Page, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { slugify } from '../common/utils/slugify';
import { uniquePageSlug } from '../common/utils/unique-content-slug';
import type { CreatePageDto } from './dto/create-page.dto';
import type { UpdatePageDto } from './dto/update-page.dto';
import type { ListPagesDto } from './dto/list-pages.dto';

const PAGE_INCLUDE = {
  blocks: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      type: true,
      title: true,
      dataJson: true,
      sortOrder: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.PageInclude;

export type PageResponse = Prisma.PageGetPayload<{ include: typeof PAGE_INCLUDE }>;

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(
    tenantId: string,
    mallId: string | undefined,
    query: ListPagesDto,
  ): Promise<{ pages: PageResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildListWhere(tenantId, mallId, query);
    const orderBy = this.buildOrderBy(query);

    const [pages, total] = await Promise.all([
      this.prisma.page.findMany({ where, include: PAGE_INCLUDE, orderBy, skip, take: limit }),
      this.prisma.page.count({ where }),
    ]);

    return { pages, total, page, limit };
  }

  async findOne(id: string, tenantId: string, mallId: string | undefined): Promise<PageResponse> {
    const page = await this.prisma.page.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: PAGE_INCLUDE,
    });
    if (!page) throw new NotFoundException('Page not found');
    this.assertMallVisibility(page, mallId);
    return page;
  }

  async create(
    dto: CreatePageDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<PageResponse> {
    const effectiveMallId = mallId ?? null;
    const status = dto.status ?? 'DRAFT';

    const baseSlug = dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.title);
    const slug = await uniquePageSlug(this.prisma, tenantId, baseSlug);

    const page = await this.prisma.page.create({
      data: {
        tenantId,
        mallId: effectiveMallId,
        title: dto.title,
        slug,
        type: dto.type ?? 'STANDARD',
        status,
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
        seoKeywords: dto.seoKeywords ?? null,
        createdBy: user.id,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
      include: PAGE_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? undefined,
      action: 'page:create',
      entityType: 'page',
      entityId: page.id,
      after: { title: page.title, status: page.status, slug: page.slug, type: page.type },
    });

    return page;
  }

  async update(
    id: string,
    dto: UpdatePageDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<PageResponse> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    let slug = existing.slug;
    if (dto.slug !== undefined && dto.slug.trim().length > 0) {
      const candidate = slugify(dto.slug);
      slug = candidate === existing.slug ? existing.slug : await uniquePageSlug(this.prisma, tenantId, candidate, id);
    } else if (dto.title !== undefined && dto.title !== existing.title && dto.slug === undefined) {
      const candidate = slugify(dto.title);
      slug = candidate === existing.slug ? existing.slug : await uniquePageSlug(this.prisma, tenantId, candidate, id);
    }

    const nextStatus = dto.status ?? existing.status;
    const publishedPatch: { publishedAt?: Date | null } = {};
    if (nextStatus === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      publishedPatch.publishedAt = new Date();
    } else if ((nextStatus === 'DRAFT' || nextStatus === 'SCHEDULED') && existing.status === 'PUBLISHED') {
      publishedPatch.publishedAt = null;
    }

    const page = await this.prisma.page.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        slug,
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.seoTitle !== undefined && { seoTitle: dto.seoTitle || null }),
        ...(dto.seoDescription !== undefined && { seoDescription: dto.seoDescription || null }),
        ...(dto.seoKeywords !== undefined && { seoKeywords: dto.seoKeywords || null }),
        updatedBy: user.id,
        ...publishedPatch,
      },
      include: PAGE_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? page.mallId ?? undefined,
      action: 'page:update',
      entityType: 'page',
      entityId: page.id,
      before: { title: existing.title, status: existing.status },
      after: { title: page.title, status: page.status },
    });

    return page;
  }

  async remove(id: string, user: User, tenantId: string, mallId: string | undefined): Promise<void> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    await this.prisma.page.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? existing.mallId ?? undefined,
      action: 'page:delete',
      entityType: 'page',
      entityId: id,
      before: { title: existing.title, status: existing.status },
    });
  }

  async publish(id: string, user: User, tenantId: string, mallId: string | undefined): Promise<PageResponse> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    if (!existing.title?.trim()) {
      throw new UnprocessableEntityException('Title is required to publish a page');
    }

    const page = await this.prisma.page.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), updatedBy: user.id },
      include: PAGE_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? page.mallId ?? undefined,
      action: 'page:publish',
      entityType: 'page',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'PUBLISHED', publishedAt: page.publishedAt },
    });

    return page;
  }

  async archive(id: string, user: User, tenantId: string, mallId: string | undefined): Promise<PageResponse> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    const page = await this.prisma.page.update({
      where: { id },
      data: { status: 'ARCHIVED', updatedBy: user.id },
      include: PAGE_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? page.mallId ?? undefined,
      action: 'page:archive',
      entityType: 'page',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'ARCHIVED' },
    });

    return page;
  }

  // ── Public rendering helpers ──────────────────────────────────────────────

  async getPublishedPageForPublic(opts: {
    tenantId: string;
    mallId?: string;
    slug: string;
  }): Promise<PageResponse | null> {
    const mallScope: Prisma.PageWhereInput =
      opts.mallId !== undefined
        ? { OR: [{ mallId: opts.mallId }, { mallId: null }] }
        : {};

    const page = await this.prisma.page.findFirst({
      where: {
        tenantId: opts.tenantId,
        slug: opts.slug,
        status: 'PUBLISHED',
        deletedAt: null,
        ...mallScope,
      },
      include: {
        blocks: {
          where: { deletedAt: null, status: 'ACTIVE' },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return page;
  }

  async getPublishedPagesForPublic(opts: {
    tenantId: string;
    mallId?: string;
    type?: string;
  }): Promise<PageResponse[]> {
    const mallScope: Prisma.PageWhereInput =
      opts.mallId !== undefined
        ? { OR: [{ mallId: opts.mallId }, { mallId: null }] }
        : {};

    return this.prisma.page.findMany({
      where: {
        tenantId: opts.tenantId,
        status: 'PUBLISHED',
        deletedAt: null,
        ...mallScope,
        ...(opts.type ? { type: opts.type as any } : {}),
      },
      include: {
        blocks: {
          where: { deletedAt: null, status: 'ACTIVE' },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<PageResponse[]>;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildListWhere(
    tenantId: string,
    mallId: string | undefined,
    query: ListPagesDto,
  ): Prisma.PageWhereInput {
    const mallScope: Prisma.PageWhereInput =
      mallId !== undefined ? { OR: [{ mallId }, { mallId: null }] } : {};

    return {
      tenantId,
      deletedAt: null,
      ...mallScope,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { slug: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(query: ListPagesDto): Prisma.PageOrderByWithRelationInput[] {
    const dir = query.sortDir === 'desc' ? 'desc' : 'asc';
    if (query.sortBy === 'title') return [{ title: dir }];
    if (query.sortBy === 'updatedAt') return [{ updatedAt: dir }];
    return [{ createdAt: dir }];
  }

  private assertMallVisibility(page: Page, mallId: string | undefined): void {
    if (mallId === undefined) return;
    if (page.mallId === null) return;
    if (page.mallId !== mallId) throw new NotFoundException('Page not found');
  }

  private async assertExists(id: string, tenantId: string): Promise<Page> {
    const page = await this.prisma.page.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }
}
