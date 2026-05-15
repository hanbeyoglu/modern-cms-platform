import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Page, PageType, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { SearchIndexerService } from '../search/search-indexer.service';
import { resolvePageSchedule } from '../common/utils/publish-workflow';
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
  attachments: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      title: true,
      description: true,
      mediaId: true,
      sortOrder: true,
      downloadable: true,
      createdAt: true,
      updatedAt: true,
      media: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          publicUrl: true,
          altText: true,
          caption: true,
          width: true,
          height: true,
        },
      },
    },
  },
} satisfies Prisma.PageInclude;

export type PageResponse = Prisma.PageGetPayload<{ include: typeof PAGE_INCLUDE }>;

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  private schedulePageIndex(pageId: string): void {
    void this.searchIndexer.syncPage(pageId).catch(() => undefined);
  }

  private assertPageTypeFields(type: string, customTypeLabel?: string | null): void {
    if (type === 'CUSTOM' && !customTypeLabel?.trim()) {
      throw new UnprocessableEntityException('customTypeLabel is required for custom pages');
    }
  }

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
    this.assertPageTypeFields(dto.type ?? 'STANDARD', dto.customTypeLabel);
    const schedule = resolvePageSchedule({
      status,
      publishAt: dto.publishAt,
      unpublishAt: dto.unpublishAt,
    });

    const baseSlug = dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.title);
    const slug = await uniquePageSlug(this.prisma, tenantId, baseSlug);

    const page = await this.prisma.page.create({
      data: {
        tenantId,
        mallId: effectiveMallId,
        title: dto.title,
        slug,
        type: dto.type ?? 'STANDARD',
        customTypeLabel: dto.type === 'CUSTOM' ? dto.customTypeLabel?.trim() : null,
        contentHtml: dto.contentHtml ?? null,
        status,
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
        seoKeywords: dto.seoKeywords ?? null,
        publishAt: schedule.publishAt,
        unpublishAt: schedule.unpublishAt,
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

    if (dto.attachments !== undefined) {
      await this.replaceAttachments(page.id, dto.attachments, user, tenantId, effectiveMallId);
      this.schedulePageIndex(page.id);
      return this.findOne(page.id, tenantId, mallId);
    }

    this.schedulePageIndex(page.id);
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
    const nextType = dto.type ?? existing.type;
    const nextCustomTypeLabel =
      dto.customTypeLabel !== undefined ? dto.customTypeLabel : existing.customTypeLabel;
    this.assertPageTypeFields(nextType, nextCustomTypeLabel);

    const schedule = resolvePageSchedule({
      status: nextStatus,
      publishAt:
        dto.publishAt !== undefined
          ? dto.publishAt
            ? dto.publishAt
            : null
          : existing.publishAt,
      unpublishAt:
        dto.unpublishAt !== undefined
          ? dto.unpublishAt
            ? dto.unpublishAt
            : null
          : existing.unpublishAt,
    });

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
        ...(dto.customTypeLabel !== undefined || dto.type !== undefined
          ? { customTypeLabel: nextType === 'CUSTOM' ? nextCustomTypeLabel?.trim() || null : null }
          : {}),
        ...(dto.contentHtml !== undefined && { contentHtml: dto.contentHtml || null }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.seoTitle !== undefined && { seoTitle: dto.seoTitle || null }),
        ...(dto.seoDescription !== undefined && { seoDescription: dto.seoDescription || null }),
        ...(dto.seoKeywords !== undefined && { seoKeywords: dto.seoKeywords || null }),
        publishAt: schedule.publishAt,
        unpublishAt: schedule.unpublishAt,
        updatedBy: user.id,
        ...publishedPatch,
      },
      include: PAGE_INCLUDE,
    });

    if (dto.attachments !== undefined) {
      await this.replaceAttachments(page.id, dto.attachments, user, tenantId, page.mallId);
    }

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

    this.schedulePageIndex(page.id);
    return dto.attachments !== undefined ? this.findOne(page.id, tenantId, mallId) : page;
  }

  private async replaceAttachments(
    pageId: string,
    attachments: NonNullable<CreatePageDto['attachments']>,
    user: User,
    tenantId: string,
    mallId: string | null,
  ): Promise<void> {
    const mediaIds = attachments.map((attachment) => attachment.mediaId);
    if (new Set(mediaIds).size !== mediaIds.length) {
      throw new UnprocessableEntityException('Each page attachment must use a unique media asset');
    }

    const media = await this.prisma.mediaAsset.findMany({
      where: { id: { in: mediaIds }, tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, mallId: true },
    });
    const validMediaIds = new Set(media.map((asset) => asset.id));
    const invalid = mediaIds.find((id) => !validMediaIds.has(id));
    if (invalid) {
      throw new UnprocessableEntityException('Attachment media not found or inactive');
    }
    const mediaById = new Map(media.map((asset) => [asset.id, asset]));
    for (const attachment of attachments) {
      const asset = mediaById.get(attachment.mediaId);
      if (mallId && asset?.mallId && asset.mallId !== mallId) {
        throw new UnprocessableEntityException('Attachment media must belong to the selected location');
      }
    }

    await this.prisma.$transaction([
      this.prisma.pageAttachment.updateMany({
        where: { pageId, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: user.id },
      }),
      ...attachments.map((attachment, index) =>
        this.prisma.pageAttachment.create({
          data: {
            tenantId,
            mallId,
            pageId,
            mediaId: attachment.mediaId,
            title: attachment.title?.trim() || null,
            description: attachment.description?.trim() || null,
            sortOrder: attachment.sortOrder ?? index * 10,
            downloadable: attachment.downloadable ?? true,
            createdBy: user.id,
          },
        }),
      ),
    ]);
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

    this.schedulePageIndex(id);
  }

  async publish(id: string, user: User, tenantId: string, mallId: string | undefined): Promise<PageResponse> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    if (!existing.title?.trim()) {
      throw new UnprocessableEntityException('Title is required to publish a page');
    }

    const now = new Date();
    const page = await this.prisma.page.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: now,
        publishAt: existing.publishAt ?? now,
        updatedBy: user.id,
      },
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

    this.schedulePageIndex(page.id);
    return page;
  }

  async archive(id: string, user: User, tenantId: string, mallId: string | undefined): Promise<PageResponse> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    const now = new Date();
    const page = await this.prisma.page.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        unpublishAt: existing.unpublishAt ?? now,
        updatedBy: user.id,
      },
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

    this.schedulePageIndex(page.id);
    return page;
  }

  // ── Public rendering helpers ──────────────────────────────────────────────

  async getPublishedPageForPublic(opts: {
    tenantId: string;
    mallId?: string;
    slug: string;
  }): Promise<PageResponse | null> {
    const now = new Date();
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
        AND: [
          { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
          { OR: [{ unpublishAt: null }, { unpublishAt: { gte: now } }] },
        ],
      },
      include: {
        attachments: PAGE_INCLUDE.attachments,
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
    type?: PageType;
  }): Promise<PageResponse[]> {
    const now = new Date();
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
        AND: [
          { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
          { OR: [{ unpublishAt: null }, { unpublishAt: { gte: now } }] },
        ],
        ...(opts.type ? { type: opts.type } : {}),
      },
      include: {
        attachments: PAGE_INCLUDE.attachments,
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
      ...(query.status ? { status: query.status } : { status: { not: 'ARCHIVED' } }),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { slug: { contains: query.search, mode: 'insensitive' as const } },
              { customTypeLabel: { contains: query.search, mode: 'insensitive' as const } },
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
