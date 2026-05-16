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
import { resolveRangeSchedule } from '../common/utils/publish-workflow';
import { uniqueEventSlug } from '../common/utils/unique-content-slug';
import type { CreateEventDto } from './dto/create-event.dto';
import type { UpdateEventDto } from './dto/update-event.dto';
import type { ListEventsDto } from './dto/list-events.dto';

const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  originalName: true,
  mimeType: true,
} as const;

const EVENT_INCLUDE = {
  coverMedia: { select: MEDIA_SELECT },
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
    const schedule = resolveRangeSchedule({
      status,
      startAt: dto.startAt,
      endAt: dto.endAt,
    });
    if (dto.coverMediaId) {
      await this.assertCoverMediaInScope(tenantId, mallId ?? null, dto.coverMediaId);
    }
    if (status === 'PUBLISHED') {
      await this.assertPublishable(
        dto.title,
        dto.coverMediaId,
        tenantId,
        mallId ?? null,
        schedule.startAt?.toISOString(),
        schedule.endAt?.toISOString(),
      );
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
        coverMediaId: dto.coverMediaId ?? null,
        coverMediaWidthOverride: dto.coverMediaWidthOverride ?? null,
        coverMediaHeightOverride: dto.coverMediaHeightOverride ?? null,
        startAt: schedule.startAt,
        endAt: schedule.endAt,
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
    return event;
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
    const nextCover = dto.coverMediaId !== undefined ? dto.coverMediaId : existing.coverMediaId;
    const nextStatus = dto.status ?? existing.status;
    const schedule = resolveRangeSchedule({
      status: nextStatus,
      startAt:
        dto.startAt !== undefined ? (dto.startAt ? dto.startAt : null) : existing.startAt,
      endAt: dto.endAt !== undefined ? (dto.endAt ? dto.endAt : null) : existing.endAt,
    });
    const nextStart = schedule.startAt?.toISOString();
    const nextEnd = schedule.endAt?.toISOString();

    const nextMallId = dto.mallId !== undefined ? dto.mallId : existing.mallId;

    if (dto.coverMediaId) {
      await this.assertCoverMediaInScope(tenantId, nextMallId, dto.coverMediaId);
    }

    if (nextStatus === 'PUBLISHED') {
      await this.assertPublishable(
        nextTitle,
        nextCover ?? undefined,
        tenantId,
        nextMallId,
        nextStart ?? undefined,
        nextEnd ?? undefined,
      );
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

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        slug,
        ...(dto.shortDescription !== undefined && { shortDescription: dto.shortDescription || null }),
        ...(dto.description !== undefined && { description: dto.description || null }),
        ...(dto.coverMediaId !== undefined && { coverMediaId: dto.coverMediaId || null }),
        ...(dto.coverMediaWidthOverride !== undefined && {
          coverMediaWidthOverride: dto.coverMediaWidthOverride,
        }),
        ...(dto.coverMediaHeightOverride !== undefined && {
          coverMediaHeightOverride: dto.coverMediaHeightOverride,
        }),
        startAt: schedule.startAt,
        endAt: schedule.endAt,
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
      include: EVENT_INCLUDE,
    });

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

    await this.assertPublishable(
      existing.title,
      existing.coverMediaId ?? undefined,
      tenantId,
      existing.mallId,
      existing.startAt?.toISOString(),
      existing.endAt?.toISOString(),
    );

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
        startAt: existing.startAt ?? now,
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
        endAt: existing.endAt ?? now,
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
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gte: now } }] },
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
      orderBy: [{ sortOrder: 'asc' }, { startAt: 'asc' }],
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
            startAt: {
              ...(query.startFrom ? { gte: new Date(query.startFrom) } : {}),
              ...(query.startTo ? { lte: new Date(query.startTo) } : {}),
            },
          }
        : {}),
      ...(query.endFrom || query.endTo
        ? {
            endAt: {
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
    if (sortBy === 'startAt') {
      return [{ startAt: dir }, { sortOrder: 'asc' }];
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

  private async assertPublishable(
    title: string,
    coverMediaId: string | undefined,
    tenantId: string,
    mallId: string | null | undefined,
    startAt?: string,
    endAt?: string,
  ): Promise<void> {
    if (!title?.trim()) {
      throw new UnprocessableEntityException('Title is required to publish');
    }
    if (!coverMediaId) {
      throw new UnprocessableEntityException('coverMediaId is required to publish an event');
    }
    validateStartBeforeEnd(startAt, endAt);
    await this.assertCoverMediaInScope(tenantId, mallId ?? null, coverMediaId);
  }

  private toPrismaJson(
    v: Record<string, unknown> | undefined,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    if (v === undefined) return undefined;
    if (v === null) return Prisma.JsonNull;
    return v as Prisma.InputJsonValue;
  }
}
