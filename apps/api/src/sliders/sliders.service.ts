import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  Channel,
  Prisma,
  Slider,
  SliderLinkedEntityType,
  SliderPlacementType,
  SliderStatus,
  User,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { SearchIndexerService } from '../search/search-indexer.service';
import { resolveRangeSchedule } from '../common/utils/publish-workflow';
import type { CreateSliderDto } from './dto/create-slider.dto';
import type { UpdateSliderDto } from './dto/update-slider.dto';
import type { ListSlidersDto } from './dto/list-sliders.dto';
import type { ReorderSlidersDto } from './dto/reorder-sliders.dto';
import type { CreateSliderItemDto } from './dto/create-slider-item.dto';
import type { UpdateSliderItemDto } from './dto/update-slider-item.dto';
import type { ReorderSliderItemsDto } from './dto/reorder-slider-items.dto';
import type { SliderItemTranslationDto } from './dto/slider-item-translation.dto.js';

const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  originalName: true,
  mimeType: true,
  width: true,
  height: true,
} as const;

const ITEM_INCLUDE = {
  sharedImage: { select: MEDIA_SELECT },
  sharedMobileImage: { select: MEDIA_SELECT },
  translations: {
    include: {
      locale: { select: { id: true, code: true } },
      image: { select: MEDIA_SELECT },
      mobileImage: { select: MEDIA_SELECT },
    },
  },
} satisfies Prisma.SliderItemInclude;

const PUBLIC_SLIDER_INCLUDE = {
  items: {
    where: { deletedAt: null, status: 'PUBLISHED' as const },
    include: ITEM_INCLUDE,
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.SliderInclude;

const SLIDER_INCLUDE = {
  items: {
    where: { deletedAt: null },
    include: ITEM_INCLUDE,
    orderBy: { sortOrder: 'asc' as const },
  },
  _count: { select: { items: { where: { deletedAt: null } } } },
} satisfies Prisma.SliderInclude;

export type SliderItemResponse = Prisma.SliderItemGetPayload<{ include: typeof ITEM_INCLUDE }>;
export type SliderResponse = Prisma.SliderGetPayload<{ include: typeof SLIDER_INCLUDE }>;

@Injectable()
export class SlidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  private scheduleSliderIndex(id: string): void {
    void this.searchIndexer.syncSlider(id).catch(() => undefined);
  }

  private scheduleSliderItemIndex(itemId: string): void {
    void this.searchIndexer.syncSliderItem(itemId).catch(() => undefined);
  }

  async list(
    tenantId: string,
    mallId: string | undefined,
    query: ListSlidersDto,
  ): Promise<{ sliders: SliderResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SliderWhereInput = {
      tenantId,
      deletedAt: null,
      ...(mallId !== undefined ? { mallId } : {}),
      ...(query.status ? { status: query.status } : { status: { not: 'ARCHIVED' } }),
      ...(query.placementType ? { placementType: query.placementType } : {}),
      ...(query.linkedEntityType ? { linkedEntityType: query.linkedEntityType } : {}),
      ...(query.linkedEntityId ? { linkedEntityId: query.linkedEntityId } : {}),
      ...(query.channel ? { channels: { has: query.channel } } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [sliders, total] = await Promise.all([
      this.prisma.slider.findMany({
        where,
        include: SLIDER_INCLUDE,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.slider.count({ where }),
    ]);

    return { sliders, total, page, limit };
  }

  async findOne(id: string, tenantId: string): Promise<SliderResponse> {
    const slider = await this.prisma.slider.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: SLIDER_INCLUDE,
    });
    if (!slider) throw new NotFoundException('Slider not found');
    return slider;
  }

  async create(
    dto: CreateSliderDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<SliderResponse> {
    this.assertPlacementLink(dto.placementType, dto.linkedEntityType, dto.linkedEntityId);

    const status = dto.status ?? 'DRAFT';
    const schedule = resolveRangeSchedule({
      status,
      startAt: dto.startAt,
      endAt: dto.endAt,
    });

    const slider = await this.prisma.slider.create({
      data: {
        tenantId,
        mallId: mallId ?? null,
        title: dto.title,
        placementType: dto.placementType ?? 'HOME',
        linkedEntityType: dto.linkedEntityType ?? null,
        linkedEntityId: dto.linkedEntityId ?? null,
        startAt: schedule.startAt,
        endAt: schedule.endAt,
        sortOrder: dto.sortOrder ?? 0,
        status,
        channels: (dto.channels as Channel[]) ?? ['WEB', 'MOBILE'],
        createdBy: user.id,
      },
      include: SLIDER_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'slider:create',
      entityType: 'slider',
      entityId: slider.id,
      after: { title: slider.title, status: slider.status, placementType: slider.placementType },
    });

    this.scheduleSliderIndex(slider.id);
    return slider;
  }

  async update(
    id: string,
    dto: UpdateSliderDto,
    user: User,
    tenantId: string,
  ): Promise<SliderResponse> {
    const existing = await this.assertExists(id, tenantId);

    const nextPlacement = dto.placementType ?? existing.placementType;
    const nextLinkedType =
      dto.linkedEntityType !== undefined ? dto.linkedEntityType : existing.linkedEntityType;
    const nextLinkedId =
      dto.linkedEntityId !== undefined ? dto.linkedEntityId : existing.linkedEntityId;
    this.assertPlacementLink(nextPlacement, nextLinkedType, nextLinkedId);

    const nextStatus = dto.status ?? existing.status;
    const schedule = resolveRangeSchedule({
      status: nextStatus,
      startAt:
        dto.startAt !== undefined ? (dto.startAt ? dto.startAt : null) : existing.startAt,
      endAt: dto.endAt !== undefined ? (dto.endAt ? dto.endAt : null) : existing.endAt,
    });

    if (nextStatus === 'PUBLISHED') {
      await this.assertGroupPublishable(id);
    }

    const slider = await this.prisma.slider.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.placementType !== undefined && { placementType: dto.placementType }),
        ...(dto.linkedEntityType !== undefined && {
          linkedEntityType: dto.linkedEntityType || null,
        }),
        ...(dto.linkedEntityId !== undefined && { linkedEntityId: dto.linkedEntityId || null }),
        startAt: schedule.startAt,
        endAt: schedule.endAt,
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.channels !== undefined && { channels: dto.channels as Channel[] }),
        updatedBy: user.id,
      },
      include: SLIDER_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: slider.mallId ?? undefined,
      action: 'slider:update',
      entityType: 'slider',
      entityId: slider.id,
      before: { title: existing.title, status: existing.status },
      after: { title: slider.title, status: slider.status },
    });

    this.scheduleSliderIndex(slider.id);
    return slider;
  }

  async remove(id: string, user: User, tenantId: string): Promise<void> {
    const existing = await this.assertExists(id, tenantId);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.sliderItem.updateMany({
        where: { sliderId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.slider.update({
        where: { id },
        data: { deletedAt: now },
      }),
    ]);

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: existing.mallId ?? undefined,
      action: 'slider:delete',
      entityType: 'slider',
      entityId: id,
      before: { title: existing.title, status: existing.status },
    });

    this.scheduleSliderIndex(id);
  }

  async publish(id: string, user: User, tenantId: string): Promise<SliderResponse> {
    const existing = await this.assertExists(id, tenantId);
    await this.assertGroupPublishable(id);

    const now = new Date();
    const slider = await this.prisma.slider.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        startAt: existing.startAt ?? now,
        updatedBy: user.id,
      },
      include: SLIDER_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: slider.mallId ?? undefined,
      action: 'slider:publish',
      entityType: 'slider',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'PUBLISHED' },
    });

    this.scheduleSliderIndex(slider.id);
    return slider;
  }

  async archive(id: string, user: User, tenantId: string): Promise<SliderResponse> {
    const existing = await this.assertExists(id, tenantId);

    const now = new Date();
    const slider = await this.prisma.slider.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        endAt: existing.endAt ?? now,
        updatedBy: user.id,
      },
      include: SLIDER_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: slider.mallId ?? undefined,
      action: 'slider:archive',
      entityType: 'slider',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'ARCHIVED' },
    });

    this.scheduleSliderIndex(slider.id);
    return slider;
  }

  async reorder(
    dto: ReorderSlidersDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<void> {
    if (dto.items.length === 0) return;

    const ids = dto.items.map((i) => i.id);
    const existing = await this.prisma.slider.findMany({
      where: {
        id: { in: ids },
        tenantId,
        deletedAt: null,
        ...(mallId !== undefined ? { mallId } : {}),
      },
      select: { id: true },
    });

    if (existing.length !== ids.length) {
      throw new BadRequestException('One or more sliders not found in this tenant/mall scope');
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.slider.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder, updatedBy: user.id },
        }),
      ),
    );

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'slider:reorder',
      entityType: 'slider',
      after: { itemCount: dto.items.length, ids },
    });

    for (const sid of ids) {
      this.scheduleSliderIndex(sid);
    }
  }

  // ─── Slider items ────────────────────────────────────────────────────────────

  async listItems(sliderId: string, tenantId: string): Promise<SliderItemResponse[]> {
    await this.assertExists(sliderId, tenantId);
    return this.prisma.sliderItem.findMany({
      where: { sliderId, deletedAt: null },
      include: ITEM_INCLUDE,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createItem(
    sliderId: string,
    dto: CreateSliderItemDto,
    user: User,
    tenantId: string,
  ): Promise<SliderItemResponse> {
    await this.assertExists(sliderId, tenantId);
    if (dto.linkUrl) this.assertValidUrl(dto.linkUrl);

    const sameImageForAllLocales = dto.sameImageForAllLocales ?? true;
    const sharedImageId = dto.sharedImageId ?? dto.desktopMediaId ?? null;
    const sharedMobileImageId = dto.sharedMobileImageId ?? dto.mobileMediaId ?? null;
    const status = dto.status ?? 'DRAFT';

    if (status === 'PUBLISHED') {
      await this.assertItemMediaValid({
        tenantId,
        sameImageForAllLocales,
        sharedImageId,
        translations: dto.translations,
      });
    }

    const item = await this.prisma.sliderItem.create({
      data: {
        sliderId,
        title: dto.title ?? null,
        description: dto.description ?? null,
        buttonText: dto.buttonText ?? null,
        linkUrl: dto.linkUrl ?? null,
        sameImageForAllLocales,
        sharedImageId,
        sharedMobileImageId,
        desktopMediaWidthOverride: dto.desktopMediaWidthOverride ?? null,
        desktopMediaHeightOverride: dto.desktopMediaHeightOverride ?? null,
        mobileMediaWidthOverride: dto.mobileMediaWidthOverride ?? null,
        mobileMediaHeightOverride: dto.mobileMediaHeightOverride ?? null,
        sortOrder: dto.sortOrder ?? 0,
        status,
      },
      include: ITEM_INCLUDE,
    });

    if (dto.translations?.length) {
      await this.upsertItemTranslations(item.id, dto.translations);
    }

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'slider:item:create',
      entityType: 'slider_item',
      entityId: item.id,
      after: { sliderId, sortOrder: item.sortOrder },
    });

    this.scheduleSliderIndex(sliderId);
    this.scheduleSliderItemIndex(item.id);
    return this.findItemById(item.id, sliderId);
  }

  async updateItem(
    sliderId: string,
    itemId: string,
    dto: UpdateSliderItemDto,
    user: User,
    tenantId: string,
  ): Promise<SliderItemResponse> {
    await this.assertExists(sliderId, tenantId);
    const existing = await this.assertItemExists(itemId, sliderId);

    if (dto.linkUrl) this.assertValidUrl(dto.linkUrl);

    const nextSameImage =
      dto.sameImageForAllLocales !== undefined
        ? dto.sameImageForAllLocales
        : existing.sameImageForAllLocales;
    const nextSharedImageId =
      dto.sharedImageId !== undefined
        ? dto.sharedImageId
        : dto.desktopMediaId !== undefined
          ? dto.desktopMediaId
          : existing.sharedImageId;
    const nextSharedMobileImageId =
      dto.sharedMobileImageId !== undefined
        ? dto.sharedMobileImageId
        : dto.mobileMediaId !== undefined
          ? dto.mobileMediaId
          : existing.sharedMobileImageId;
    const nextStatus = dto.status ?? existing.status;

    if (nextStatus === 'PUBLISHED') {
      await this.assertItemMediaValid({
        tenantId,
        sameImageForAllLocales: nextSameImage,
        sharedImageId: nextSharedImageId,
        translations: dto.translations,
        itemId,
      });
    }

    await this.prisma.sliderItem.update({
      where: { id: itemId },
      data: {
        ...(dto.title !== undefined && { title: dto.title || null }),
        ...(dto.description !== undefined && { description: dto.description || null }),
        ...(dto.buttonText !== undefined && { buttonText: dto.buttonText || null }),
        ...(dto.linkUrl !== undefined && { linkUrl: dto.linkUrl || null }),
        ...(dto.sameImageForAllLocales !== undefined && {
          sameImageForAllLocales: dto.sameImageForAllLocales,
        }),
        ...(dto.sharedImageId !== undefined || dto.desktopMediaId !== undefined
          ? { sharedImageId: nextSharedImageId || null }
          : {}),
        ...(dto.sharedMobileImageId !== undefined || dto.mobileMediaId !== undefined
          ? { sharedMobileImageId: nextSharedMobileImageId || null }
          : {}),
        ...(dto.desktopMediaWidthOverride !== undefined && {
          desktopMediaWidthOverride: dto.desktopMediaWidthOverride,
        }),
        ...(dto.desktopMediaHeightOverride !== undefined && {
          desktopMediaHeightOverride: dto.desktopMediaHeightOverride,
        }),
        ...(dto.mobileMediaWidthOverride !== undefined && {
          mobileMediaWidthOverride: dto.mobileMediaWidthOverride,
        }),
        ...(dto.mobileMediaHeightOverride !== undefined && {
          mobileMediaHeightOverride: dto.mobileMediaHeightOverride,
        }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    if (dto.translations !== undefined) {
      await this.upsertItemTranslations(itemId, dto.translations);
    }

    const item = await this.findItemById(itemId, sliderId);

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'slider:item:update',
      entityType: 'slider_item',
      entityId: item.id,
      after: { sliderId, sortOrder: item.sortOrder, status: item.status },
    });

    this.scheduleSliderIndex(sliderId);
    this.scheduleSliderItemIndex(item.id);
    return item;
  }

  async removeItem(
    sliderId: string,
    itemId: string,
    user: User,
    tenantId: string,
  ): Promise<void> {
    await this.assertExists(sliderId, tenantId);
    await this.assertItemExists(itemId, sliderId);

    await this.prisma.sliderItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'slider:item:delete',
      entityType: 'slider_item',
      entityId: itemId,
      after: { sliderId },
    });

    this.scheduleSliderIndex(sliderId);
    this.scheduleSliderItemIndex(itemId);
  }

  async reorderItems(
    sliderId: string,
    dto: ReorderSliderItemsDto,
    user: User,
    tenantId: string,
  ): Promise<void> {
    await this.assertExists(sliderId, tenantId);
    if (dto.items.length === 0) return;

    const ids = dto.items.map((i) => i.id);
    const existing = await this.prisma.sliderItem.findMany({
      where: { id: { in: ids }, sliderId, deletedAt: null },
      select: { id: true },
    });

    if (existing.length !== ids.length) {
      throw new BadRequestException('One or more slider items not found for this slider');
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.sliderItem.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'slider:item:reorder',
      entityType: 'slider',
      entityId: sliderId,
      after: { itemCount: dto.items.length, ids },
    });

    this.scheduleSliderIndex(sliderId);
  }

  // ─── Public ──────────────────────────────────────────────────────────────────

  async getPublishedSlidersForPublic(opts: {
    tenantId: string;
    mallId?: string;
    placement?: SliderPlacementType;
    entityId?: string;
    channel?: string;
    limit?: number;
  }): Promise<Prisma.SliderGetPayload<{ include: typeof PUBLIC_SLIDER_INCLUDE }>[]> {
    const now = new Date();

    return this.prisma.slider.findMany({
      where: {
        tenantId: opts.tenantId,
        deletedAt: null,
        status: 'PUBLISHED' as SliderStatus,
        ...(opts.mallId !== undefined ? { mallId: opts.mallId } : {}),
        ...(opts.placement ? { placementType: opts.placement } : {}),
        ...(opts.entityId
          ? { linkedEntityId: opts.entityId }
          : {}),
        ...(opts.channel ? { channels: { has: opts.channel as Channel } } : {}),
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      include: PUBLIC_SLIDER_INCLUDE,
      orderBy: { sortOrder: 'asc' },
      take: opts.limit ?? 10,
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async assertExists(id: string, tenantId: string): Promise<Slider> {
    const slider = await this.prisma.slider.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!slider) throw new NotFoundException('Slider not found');
    return slider;
  }

  private async assertItemExists(itemId: string, sliderId: string) {
    const item = await this.prisma.sliderItem.findFirst({
      where: { id: itemId, sliderId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Slider item not found');
    return item;
  }

  private async assertGroupPublishable(sliderId: string): Promise<void> {
    const items = await this.prisma.sliderItem.findMany({
      where: { sliderId, deletedAt: null },
      include: {
        translations: { select: { imageId: true, mobileImageId: true } },
      },
    });

    const hasMedia = items.some(
      (item) =>
        item.sharedImageId ||
        item.sharedMobileImageId ||
        item.translations.some((t) => t.imageId || t.mobileImageId),
    );

    if (!hasMedia) {
      throw new UnprocessableEntityException(
        'At least one slider item with desktop or mobile media is required to publish',
      );
    }
  }

  private assertPlacementLink(
    placement?: SliderPlacementType,
    linkedEntityType?: SliderLinkedEntityType | null,
    linkedEntityId?: string | null,
  ): void {
    const p = placement ?? 'HOME';
    if (p === 'CAMPAIGN' || p === 'EVENT' || p === 'STORE' || p === 'LOCATION') {
      if (!linkedEntityType || !linkedEntityId) {
        throw new BadRequestException(
          `linkedEntityType and linkedEntityId are required when placementType is ${p}`,
        );
      }
      const expectedType = p === 'LOCATION' ? 'LOCATION' : p;
      if (linkedEntityType !== expectedType) {
        throw new BadRequestException(
          `linkedEntityType must be ${expectedType} for placement ${p}`,
        );
      }
    } else if (linkedEntityType || linkedEntityId) {
      throw new BadRequestException(
        'linkedEntityType and linkedEntityId are only allowed for entity-bound placements',
      );
    }
  }

  private async findItemById(itemId: string, sliderId: string): Promise<SliderItemResponse> {
    const item = await this.prisma.sliderItem.findFirst({
      where: { id: itemId, sliderId, deletedAt: null },
      include: ITEM_INCLUDE,
    });
    if (!item) throw new NotFoundException('Slider item not found');
    return item;
  }

  private async upsertItemTranslations(
    itemId: string,
    translations: SliderItemTranslationDto[],
  ): Promise<void> {
    for (const tr of translations) {
      await this.prisma.sliderItemTranslation.upsert({
        where: {
          sliderItemId_localeId: { sliderItemId: itemId, localeId: tr.localeId },
        },
        create: {
          sliderItemId: itemId,
          localeId: tr.localeId,
          title: tr.title ?? null,
          description: tr.description ?? null,
          buttonText: tr.buttonText ?? null,
          imageId: tr.imageId ?? null,
          mobileImageId: tr.mobileImageId ?? null,
        },
        update: {
          title: tr.title ?? null,
          description: tr.description ?? null,
          buttonText: tr.buttonText ?? null,
          imageId: tr.imageId ?? null,
          mobileImageId: tr.mobileImageId ?? null,
        },
      });
    }
  }

  private async getDefaultLocaleId(tenantId: string): Promise<string | null> {
    const locale = await this.prisma.locale.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
      select: { id: true },
    });
    return locale?.id ?? null;
  }

  private async assertItemMediaValid(opts: {
    tenantId: string;
    sameImageForAllLocales: boolean;
    sharedImageId?: string | null;
    translations?: SliderItemTranslationDto[];
    itemId?: string;
  }): Promise<void> {
    if (opts.sameImageForAllLocales) {
      if (!opts.sharedImageId) {
        throw new UnprocessableEntityException(
          'Shared desktop image is required when using the same image for all locales',
        );
      }
      return;
    }

    const defaultLocaleId = await this.getDefaultLocaleId(opts.tenantId);
    if (!defaultLocaleId) {
      throw new UnprocessableEntityException('Tenant default locale is not configured');
    }

    const fromPayload = opts.translations?.find((t) => t.localeId === defaultLocaleId);
    if (fromPayload?.imageId) return;

    if (opts.itemId) {
      const existing = await this.prisma.sliderItemTranslation.findUnique({
        where: {
          sliderItemId_localeId: {
            sliderItemId: opts.itemId,
            localeId: defaultLocaleId,
          },
        },
        select: { imageId: true },
      });
      if (existing?.imageId) return;
    }

    if (opts.sharedImageId) return;

    throw new UnprocessableEntityException(
      'Default locale desktop image is required when using locale-specific images',
    );
  }

  private assertValidUrl(linkValue: string): void {
    try {
      new URL(linkValue);
    } catch {
      throw new BadRequestException('linkUrl must be a valid URL');
    }
  }
}
