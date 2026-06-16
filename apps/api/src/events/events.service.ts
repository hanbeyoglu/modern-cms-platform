import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ContentStatus, Event, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { SearchIndexerService } from '../search/search-indexer.service';
import { TranslationResolverService } from '../translation-resolver/translation-resolver.service';
import { slugify } from '../common/utils/slugify';
import { assertOptionalHttpUrl, validateStartBeforeEnd } from '../common/utils/content-validation';
import {
  resolveContentPublishSchedule,
  toScheduleDate,
} from '../common/utils/publish-workflow';
import { uniqueEventSlug } from '../common/utils/unique-content-slug';
import type { CreateEventDto } from './dto/create-event.dto';
import type { UpdateEventDto } from './dto/update-event.dto';
import type { ListEventsDto } from './dto/list-events.dto';
import type { EventTranslationDto } from './dto/event-translation.dto.js';

const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  originalName: true,
  mimeType: true,
  width: true,
  height: true,
} as const;

const EVENT_INCLUDE = {
  sharedCoverImage: { select: MEDIA_SELECT },
  translations: {
    include: {
      locale: { select: { id: true, code: true } },
      coverImage: { select: MEDIA_SELECT },
    },
  },
} satisfies Prisma.EventInclude;

export type EventResponse = Prisma.EventGetPayload<{ include: typeof EVENT_INCLUDE }>;

export type EventPublishResult = {
  event: EventResponse;
  localizationWarnings: string[];
};

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly searchIndexer: SearchIndexerService,
    private readonly i18n: TranslationResolverService,
  ) {}

  private scheduleEventIndex(eventId: string): void {
    void this.searchIndexer.syncEvent(eventId).catch(() => undefined);
  }

  async list(
    tenantId: string,
    mallId: string | undefined,
    query: ListEventsDto,
  ): Promise<{ events: EventResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildListWhere(tenantId, mallId, query);
    const orderBy = this.buildOrderBy(query);

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: EVENT_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    return { events, total, page, limit };
  }

  async findOne(id: string, tenantId: string, mallId: string | undefined): Promise<EventResponse> {
    const event = await this.prisma.event.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: EVENT_INCLUDE,
    });
    if (!event) throw new NotFoundException('Event not found');
    this.assertMallVisibility(event, mallId);
    return event;
  }

  async create(
    dto: CreateEventDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<EventResponse> {
    assertOptionalHttpUrl(dto.linkUrl);

    const status = dto.status ?? 'DRAFT';
    const publishSchedule = resolveContentPublishSchedule({
      status,
      publishStartAt: dto.publishStartAt,
      publishEndAt: dto.publishEndAt,
    });
    const eventStartAt = toScheduleDate(dto.eventStartAt);
    const eventEndAt = toScheduleDate(dto.eventEndAt);
    validateStartBeforeEnd(eventStartAt, eventEndAt);

    const sameImageForAllLocales = dto.sameImageForAllLocales ?? true;

    await this.assertCoverMediaValid({
      tenantId,
      mallId: mallId ?? null,
      sameImageForAllLocales,
      sharedCoverImageId: dto.sharedCoverImageId,
      translations: dto.translations,
    });

    if (status === 'PUBLISHED') {
      await this.assertPublishable({
        title: dto.title,
        eventStartAt,
        tenantId,
        mallId: mallId ?? null,
        sameImageForAllLocales,
        sharedCoverImageId: dto.sharedCoverImageId,
        translations: dto.translations,
      });
    }

    const baseSlug = dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.title);
    const slug = await uniqueEventSlug(this.prisma, tenantId, baseSlug);
    const dynamicFieldsJson = this.toPrismaJson(dto.dynamicFieldsJson);

    const event = await this.prisma.event.create({
      data: {
        tenantId,
        mallId: mallId ?? null,
        title: dto.title,
        slug,
        shortDescription: dto.shortDescription ?? null,
        description: dto.description ?? null,
        sameImageForAllLocales,
        sharedCoverImageId: dto.sharedCoverImageId ?? null,
        coverMediaWidthOverride: dto.coverMediaWidthOverride ?? null,
        coverMediaHeightOverride: dto.coverMediaHeightOverride ?? null,
        publishStartAt: publishSchedule.publishStartAt,
        publishEndAt: publishSchedule.publishEndAt,
        eventStartAt,
        eventEndAt,
        location: dto.location ?? null,
        category: dto.category ?? null,
        buttonText: dto.buttonText ?? null,
        linkUrl: dto.linkUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
        status,
        channels: dto.channels ?? ['WEB', 'MOBILE'],
        dynamicFieldsJson: dynamicFieldsJson ?? undefined,
        createdBy: user.id,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
      include: EVENT_INCLUDE,
    });

    if (dto.translations?.length) {
      await this.upsertTranslations(event.id, dto.translations);
    }

    const result = await this.findOne(event.id, tenantId, mallId);

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? event.mallId ?? undefined,
      action: 'event:create',
      entityType: 'event',
      entityId: event.id,
      after: { title: event.title, status: event.status, slug: event.slug },
    });

    this.scheduleEventIndex(event.id);
    return result;
  }

  async update(
    id: string,
    dto: UpdateEventDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<EventResponse> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    const nextLink = dto.linkUrl !== undefined ? dto.linkUrl : existing.linkUrl;
    assertOptionalHttpUrl(nextLink);

    const nextTitle = dto.title ?? existing.title;
    const nextStatus = dto.status ?? existing.status;
    const sameImageForAllLocales = dto.sameImageForAllLocales ?? existing.sameImageForAllLocales;
    const nextSharedCover =
      dto.sharedCoverImageId !== undefined ? dto.sharedCoverImageId : existing.sharedCoverImageId;

    const publishSchedule = resolveContentPublishSchedule({
      status: nextStatus,
      publishStartAt:
        dto.publishStartAt !== undefined ? dto.publishStartAt : existing.publishStartAt,
      publishEndAt:
        dto.publishEndAt !== undefined ? dto.publishEndAt : existing.publishEndAt,
    });
    const eventStartAt =
      dto.eventStartAt !== undefined ? toScheduleDate(dto.eventStartAt) : existing.eventStartAt;
    const eventEndAt =
      dto.eventEndAt !== undefined ? toScheduleDate(dto.eventEndAt) : existing.eventEndAt;
    validateStartBeforeEnd(eventStartAt, eventEndAt);

    const nextMallId = dto.mallId !== undefined ? dto.mallId : existing.mallId;

    if (dto.sharedCoverImageId) {
      await this.assertCoverMediaInScope(tenantId, nextMallId, dto.sharedCoverImageId);
    }

    await this.assertCoverMediaValid({
      tenantId,
      mallId: nextMallId,
      sameImageForAllLocales,
      sharedCoverImageId: nextSharedCover,
      translations: dto.translations,
      skipWhenDraft: nextStatus !== 'PUBLISHED',
    });

    if (nextStatus === 'PUBLISHED') {
      await this.assertPublishable({
        title: nextTitle,
        eventStartAt,
        tenantId,
        mallId: nextMallId,
        sameImageForAllLocales,
        sharedCoverImageId: nextSharedCover ?? undefined,
        translations: dto.translations,
        eventId: id,
      });
    }

    let slug = existing.slug;
    if (dto.slug !== undefined && dto.slug.trim().length > 0) {
      const candidate = slugify(dto.slug);
      slug = candidate === existing.slug ? existing.slug : await uniqueEventSlug(this.prisma, tenantId, candidate, id);
    } else if (dto.title !== undefined && dto.title !== existing.title && dto.slug === undefined) {
      const candidate = slugify(dto.title);
      slug =
        candidate === existing.slug ? existing.slug : await uniqueEventSlug(this.prisma, tenantId, candidate, id);
    }

    const publishedPatch: { publishedAt?: Date | null } = {};
    if (nextStatus === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      publishedPatch.publishedAt = new Date();
    } else if (
      (nextStatus === 'DRAFT' || nextStatus === 'SCHEDULED') &&
      existing.status === 'PUBLISHED'
    ) {
      publishedPatch.publishedAt = null;
    }

    await this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        slug,
        ...(dto.shortDescription !== undefined && { shortDescription: dto.shortDescription || null }),
        ...(dto.description !== undefined && { description: dto.description || null }),
        ...(dto.sameImageForAllLocales !== undefined && { sameImageForAllLocales }),
        ...(dto.sharedCoverImageId !== undefined && { sharedCoverImageId: dto.sharedCoverImageId || null }),
        ...(dto.coverMediaWidthOverride !== undefined && {
          coverMediaWidthOverride: dto.coverMediaWidthOverride,
        }),
        ...(dto.coverMediaHeightOverride !== undefined && {
          coverMediaHeightOverride: dto.coverMediaHeightOverride,
        }),
        publishStartAt: publishSchedule.publishStartAt,
        publishEndAt: publishSchedule.publishEndAt,
        eventStartAt,
        eventEndAt,
        ...(dto.location !== undefined && { location: dto.location || null }),
        ...(dto.category !== undefined && { category: dto.category || null }),
        ...(dto.buttonText !== undefined && { buttonText: dto.buttonText || null }),
        ...(dto.linkUrl !== undefined && { linkUrl: dto.linkUrl || null }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.channels !== undefined && { channels: dto.channels }),
        ...(dto.dynamicFieldsJson !== undefined
          ? {
              dynamicFieldsJson:
                dto.dynamicFieldsJson === null
                  ? Prisma.JsonNull
                  : (dto.dynamicFieldsJson as Prisma.InputJsonValue),
            }
          : {}),
        ...(dto.mallId !== undefined && { mallId: dto.mallId }),
        updatedBy: user.id,
        ...publishedPatch,
      },
    });

    if (dto.translations !== undefined) {
      await this.upsertTranslations(id, dto.translations);
    }

    const event = await this.findOne(id, tenantId, mallId);

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? event.mallId ?? undefined,
      action: 'event:update',
      entityType: 'event',
      entityId: event.id,
      before: { title: existing.title, status: existing.status },
      after: { title: event.title, status: event.status },
    });

    this.scheduleEventIndex(event.id);
    return event;
  }

  async remove(id: string, user: User, tenantId: string, mallId: string | undefined): Promise<void> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    await this.prisma.event.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? existing.mallId ?? undefined,
      action: 'event:delete',
      entityType: 'event',
      entityId: id,
      before: { title: existing.title, status: existing.status },
    });

    this.scheduleEventIndex(id);
  }

  async publish(id: string, user: User, tenantId: string, mallId: string | undefined): Promise<EventPublishResult> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    await this.assertPublishable({
      title: existing.title,
      eventStartAt: existing.eventStartAt,
      tenantId,
      mallId: existing.mallId,
      sameImageForAllLocales: existing.sameImageForAllLocales,
      sharedCoverImageId: existing.sharedCoverImageId ?? undefined,
      eventId: id,
    });

    const localizationWarnings = await this.i18n.getI18nGapWarnings(
      tenantId,
      'EVENT',
      id,
      ['title', 'shortDescription', 'description', 'buttonText'],
      {
        title: existing.title,
        shortDescription: existing.shortDescription,
        description: existing.description,
        buttonText: existing.buttonText,
      },
    );

    const now = new Date();
    const event = await this.prisma.event.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: now,
        publishStartAt: existing.publishStartAt ?? now,
        updatedBy: user.id,
      },
      include: EVENT_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? event.mallId ?? undefined,
      action: 'event:publish',
      entityType: 'event',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'PUBLISHED', publishedAt: event.publishedAt },
    });

    this.scheduleEventIndex(event.id);
    return { event, localizationWarnings };
  }

  async archive(id: string, user: User, tenantId: string, mallId: string | undefined): Promise<EventResponse> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    const now = new Date();
    const event = await this.prisma.event.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        publishEndAt: existing.publishEndAt ?? now,
        updatedBy: user.id,
      },
      include: EVENT_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? event.mallId ?? undefined,
      action: 'event:archive',
      entityType: 'event',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'ARCHIVED' },
    });

    this.scheduleEventIndex(event.id);
    return event;
  }

  async getPublishedEventsForPublic(opts: {
    tenantId: string;
    mallId?: string;
    search?: string;
    category?: string;
    channel?: string;
  }): Promise<EventResponse[]> {
    const now = new Date();
    const where: Prisma.EventWhereInput = {
      tenantId: opts.tenantId,
      deletedAt: null,
      status: 'PUBLISHED' as ContentStatus,
      AND: [
        { OR: [{ publishStartAt: null }, { publishStartAt: { lte: now } }] },
        { OR: [{ publishEndAt: null }, { publishEndAt: { gte: now } }] },
      ],
      ...(opts.mallId !== undefined
        ? {
            OR: [{ mallId: opts.mallId }, { mallId: null }],
          }
        : {}),
      ...(opts.search
        ? { title: { contains: opts.search, mode: 'insensitive' as const } }
        : {}),
      ...(opts.category ? { category: opts.category } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(opts.channel ? { channels: { has: opts.channel as any } } : {}),
    };

    return this.prisma.event.findMany({
      where,
      include: EVENT_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { eventStartAt: 'asc' }],
    });
  }

  private buildListWhere(
    tenantId: string,
    mallId: string | undefined,
    query: ListEventsDto,
  ): Prisma.EventWhereInput {
    const mallScope: Prisma.EventWhereInput =
      mallId !== undefined
        ? {
            OR: [{ mallId }, { mallId: null }],
          }
        : {};

    return {
      tenantId,
      deletedAt: null,
      ...mallScope,
      ...(query.status ? { status: query.status } : { status: { not: 'ARCHIVED' } }),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.startFrom || query.startTo
        ? {
            eventStartAt: {
              ...(query.startFrom ? { gte: new Date(query.startFrom) } : {}),
              ...(query.startTo ? { lte: new Date(query.startTo) } : {}),
            },
          }
        : {}),
      ...(query.endFrom || query.endTo
        ? {
            eventEndAt: {
              ...(query.endFrom ? { gte: new Date(query.endFrom) } : {}),
              ...(query.endTo ? { lte: new Date(query.endTo) } : {}),
            },
          }
        : {}),
    };
  }

  private buildOrderBy(query: ListEventsDto): Prisma.EventOrderByWithRelationInput[] {
    const dir = query.sortDir === 'desc' ? 'desc' : 'asc';
    const sortBy = query.sortBy ?? 'sortOrder';
    if (sortBy === 'eventStartAt' || sortBy === 'startAt') {
      return [{ eventStartAt: dir }, { sortOrder: 'asc' }];
    }
    if (sortBy === 'createdAt') {
      return [{ createdAt: dir }];
    }
    return [{ sortOrder: dir }, { createdAt: 'desc' }];
  }

  private assertMallVisibility(event: Event, mallId: string | undefined): void {
    if (mallId === undefined) return;
    if (event.mallId === null) return;
    if (event.mallId !== mallId) {
      throw new NotFoundException('Event not found');
    }
  }

  private async assertExists(id: string, tenantId: string): Promise<Event> {
    const event = await this.prisma.event.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async assertCoverMediaInScope(
    tenantId: string,
    mallId: string | null | undefined,
    coverMediaId: string,
  ): Promise<void> {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: coverMediaId, tenantId, deletedAt: null },
    });
    if (!media) {
      throw new UnprocessableEntityException('Cover media not found for this tenant');
    }
    if (mallId) {
      if (media.mallId !== null && media.mallId !== mallId) {
        throw new UnprocessableEntityException(
          'Cover media must be tenant-wide or belong to the same mall as the event',
        );
      }
    }
  }

  private async getDefaultLocaleId(tenantId: string): Promise<string | null> {
    const locale = await this.prisma.locale.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
      select: { id: true },
    });
    return locale?.id ?? null;
  }

  private async upsertTranslations(
    eventId: string,
    translations: EventTranslationDto[],
  ): Promise<void> {
    for (const tr of translations) {
      if (tr.coverImageId) {
        const event = await this.prisma.event.findUnique({
          where: { id: eventId },
          select: { tenantId: true, mallId: true },
        });
        if (event) {
          await this.assertCoverMediaInScope(event.tenantId, event.mallId, tr.coverImageId);
        }
      }
      await this.prisma.eventTranslation.upsert({
        where: {
          eventId_localeId: { eventId, localeId: tr.localeId },
        },
        create: {
          eventId,
          localeId: tr.localeId,
          title: tr.title ?? null,
          description: tr.description ?? null,
          shortDescription: tr.shortDescription ?? null,
          coverImageId: tr.coverImageId ?? null,
        },
        update: {
          title: tr.title ?? null,
          description: tr.description ?? null,
          shortDescription: tr.shortDescription ?? null,
          coverImageId: tr.coverImageId ?? null,
        },
      });
    }
  }

  private async assertCoverMediaValid(opts: {
    tenantId: string;
    mallId: string | null | undefined;
    sameImageForAllLocales: boolean;
    sharedCoverImageId?: string | null;
    translations?: EventTranslationDto[];
    skipWhenDraft?: boolean;
  }): Promise<void> {
    if (opts.skipWhenDraft) return;

    if (opts.sameImageForAllLocales) {
      if (opts.sharedCoverImageId) {
        await this.assertCoverMediaInScope(opts.tenantId, opts.mallId ?? null, opts.sharedCoverImageId);
      }
      return;
    }

    if (opts.translations?.some((t) => t.coverImageId)) {
      for (const tr of opts.translations) {
        if (tr.coverImageId) {
          await this.assertCoverMediaInScope(opts.tenantId, opts.mallId ?? null, tr.coverImageId);
        }
      }
    }
  }

  private async assertPublishable(opts: {
    title: string;
    eventStartAt: Date | null;
    tenantId: string;
    mallId: string | null | undefined;
    sameImageForAllLocales: boolean;
    sharedCoverImageId?: string;
    translations?: EventTranslationDto[];
    eventId?: string;
  }): Promise<void> {
    if (!opts.title?.trim()) {
      throw new UnprocessableEntityException('Title is required to publish');
    }
    if (!opts.eventStartAt) {
      throw new UnprocessableEntityException('eventStartAt is required to publish an event');
    }

    if (opts.sameImageForAllLocales) {
      if (!opts.sharedCoverImageId) {
        throw new UnprocessableEntityException(
          'sharedCoverImageId is required to publish an event when using shared images',
        );
      }
      await this.assertCoverMediaInScope(opts.tenantId, opts.mallId ?? null, opts.sharedCoverImageId);
    } else {
      const defaultLocaleId = await this.getDefaultLocaleId(opts.tenantId);
      if (!defaultLocaleId) {
        throw new UnprocessableEntityException('Tenant default locale is not configured');
      }

      const fromPayload = opts.translations?.find((t) => t.localeId === defaultLocaleId);
      let defaultCoverId = fromPayload?.coverImageId ?? opts.sharedCoverImageId ?? null;

      if (!defaultCoverId && opts.eventId) {
        const existingTr = await this.prisma.eventTranslation.findUnique({
          where: {
            eventId_localeId: { eventId: opts.eventId, localeId: defaultLocaleId },
          },
          select: { coverImageId: true },
        });
        defaultCoverId = existingTr?.coverImageId ?? opts.sharedCoverImageId ?? null;
      }

      if (!defaultCoverId) {
        throw new UnprocessableEntityException(
          'Default locale cover image is required to publish an event',
        );
      }
      await this.assertCoverMediaInScope(opts.tenantId, opts.mallId ?? null, defaultCoverId);
    }
  }

  private toPrismaJson(
    v: Record<string, unknown> | undefined,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    if (v === undefined) return undefined;
    if (v === null) return Prisma.JsonNull;
    return v as Prisma.InputJsonValue;
  }
}
