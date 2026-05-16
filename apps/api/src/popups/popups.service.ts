import { Injectable, NotFoundException } from '@nestjs/common';
import type { Channel, Popup, PopupStatus, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { SearchIndexerService } from '../search/search-indexer.service';
import { resolveRangeSchedule } from '../common/utils/publish-workflow';
import type { CreatePopupDto } from './dto/create-popup.dto';
import type { UpdatePopupDto } from './dto/update-popup.dto';
import type { ListPopupsDto } from './dto/list-popups.dto';

const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  originalName: true,
  mimeType: true,
  altText: true,
  caption: true,
  width: true,
  height: true,
  dominantColor: true,
} as const;

const POPUP_INCLUDE = {
  imageMedia: { select: MEDIA_SELECT },
} satisfies Prisma.PopupInclude;

export type PopupResponse = Prisma.PopupGetPayload<{ include: typeof POPUP_INCLUDE }>;

@Injectable()
export class PopupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  private scheduleIndex(id: string): void {
    void this.searchIndexer.syncPopup(id).catch(() => undefined);
  }

  async list(
    tenantId: string,
    mallId: string | undefined,
    query: ListPopupsDto,
  ): Promise<{ popups: PopupResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PopupWhereInput = {
      tenantId,
      deletedAt: null,
      ...(mallId !== undefined ? { mallId } : {}),
      ...(query.status ? { status: query.status as PopupStatus } : { status: { not: 'ARCHIVED' } }),
      ...(query.channel ? { channels: { has: query.channel as Channel } } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [popups, total] = await Promise.all([
      this.prisma.popup.findMany({
        where,
        include: POPUP_INCLUDE,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.popup.count({ where }),
    ]);

    return { popups, total, page, limit };
  }

  async findOne(id: string, tenantId: string): Promise<PopupResponse> {
    const popup = await this.prisma.popup.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: POPUP_INCLUDE,
    });
    if (!popup) throw new NotFoundException('Popup not found');
    return popup;
  }

  async create(
    dto: CreatePopupDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<PopupResponse> {
    const status = dto.status ?? 'DRAFT';
    const schedule = resolveRangeSchedule({ status, startAt: dto.startAt, endAt: dto.endAt });

    const popup = await this.prisma.popup.create({
      data: {
        tenantId,
        mallId: mallId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        imageMediaId: dto.imageMediaId ?? null,
        imageMediaWidthOverride: dto.imageMediaWidthOverride ?? null,
        imageMediaHeightOverride: dto.imageMediaHeightOverride ?? null,
        linkUrl: dto.linkUrl ?? null,
        buttonText: dto.buttonText ?? null,
        status,
        channels: (dto.channels as Channel[]) ?? ['WEB', 'MOBILE'],
        startAt: schedule.startAt,
        endAt: schedule.endAt,
        sortOrder: dto.sortOrder ?? 0,
        showOnce: dto.showOnce ?? false,
        closable: dto.closable ?? true,
        metadataJson: dto.metadataJson ? (dto.metadataJson as Prisma.InputJsonValue) : undefined,
        createdBy: user.id,
      },
      include: POPUP_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'popup:create',
      entityType: 'popup',
      entityId: popup.id,
      after: { title: popup.title, status: popup.status },
    });

    this.scheduleIndex(popup.id);
    return popup;
  }

  async update(
    id: string,
    dto: UpdatePopupDto,
    user: User,
    tenantId: string,
  ): Promise<PopupResponse> {
    const existing = await this.assertExists(id, tenantId);

    const nextStatus = dto.status ?? existing.status;
    const schedule = resolveRangeSchedule({
      status: nextStatus,
      startAt: dto.startAt !== undefined ? (dto.startAt ?? null) : existing.startAt,
      endAt: dto.endAt !== undefined ? (dto.endAt ?? null) : existing.endAt,
    });

    const popup = await this.prisma.popup.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.imageMediaId !== undefined && { imageMediaId: dto.imageMediaId || null }),
        ...(dto.imageMediaWidthOverride !== undefined && {
          imageMediaWidthOverride: dto.imageMediaWidthOverride,
        }),
        ...(dto.imageMediaHeightOverride !== undefined && {
          imageMediaHeightOverride: dto.imageMediaHeightOverride,
        }),
        ...(dto.linkUrl !== undefined && { linkUrl: dto.linkUrl || null }),
        ...(dto.buttonText !== undefined && { buttonText: dto.buttonText || null }),
        ...(dto.status !== undefined && { status: dto.status as PopupStatus }),
        ...(dto.channels !== undefined && { channels: dto.channels as Channel[] }),
        startAt: schedule.startAt,
        endAt: schedule.endAt,
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.showOnce !== undefined && { showOnce: dto.showOnce }),
        ...(dto.closable !== undefined && { closable: dto.closable }),
        ...(dto.metadataJson !== undefined && { metadataJson: dto.metadataJson as Prisma.InputJsonValue }),
        updatedBy: user.id,
      },
      include: POPUP_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: popup.mallId ?? undefined,
      action: 'popup:update',
      entityType: 'popup',
      entityId: popup.id,
      before: { title: existing.title, status: existing.status },
      after: { title: popup.title, status: popup.status },
    });

    this.scheduleIndex(popup.id);
    return popup;
  }

  async remove(id: string, user: User, tenantId: string): Promise<void> {
    const existing = await this.assertExists(id, tenantId);

    await this.prisma.popup.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: existing.mallId ?? undefined,
      action: 'popup:delete',
      entityType: 'popup',
      entityId: id,
      before: { title: existing.title, status: existing.status },
    });

    this.scheduleIndex(id);
  }

  async publish(id: string, user: User, tenantId: string): Promise<PopupResponse> {
    const existing = await this.assertExists(id, tenantId);
    const now = new Date();

    const popup = await this.prisma.popup.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: now,
        startAt: existing.startAt ?? now,
        updatedBy: user.id,
      },
      include: POPUP_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: popup.mallId ?? undefined,
      action: 'popup:publish',
      entityType: 'popup',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'PUBLISHED' },
    });

    this.scheduleIndex(popup.id);
    return popup;
  }

  async archive(id: string, user: User, tenantId: string): Promise<PopupResponse> {
    const existing = await this.assertExists(id, tenantId);
    const now = new Date();

    const popup = await this.prisma.popup.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        endAt: existing.endAt ?? now,
        updatedBy: user.id,
      },
      include: POPUP_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: popup.mallId ?? undefined,
      action: 'popup:archive',
      entityType: 'popup',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'ARCHIVED' },
    });

    this.scheduleIndex(popup.id);
    return popup;
  }

  async getPublishedForPublic(opts: {
    tenantId: string;
    mallId?: string;
    channel?: string;
  }): Promise<PopupResponse[]> {
    const now = new Date();

    return this.prisma.popup.findMany({
      where: {
        tenantId: opts.tenantId,
        deletedAt: null,
        status: 'PUBLISHED' as PopupStatus,
        ...(opts.mallId !== undefined ? { mallId: opts.mallId } : {}),
        ...(opts.channel ? { channels: { has: opts.channel as Channel } } : {}),
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      include: POPUP_INCLUDE,
      orderBy: { sortOrder: 'asc' },
    });
  }

  private async assertExists(id: string, tenantId: string): Promise<Popup> {
    const popup = await this.prisma.popup.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!popup) throw new NotFoundException('Popup not found');
    return popup;
  }
}
