import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  TranslationResolverService,
  type EntityTranslationMap,
} from '../translation-resolver/translation-resolver.service';
import type {
  PublicCampaign,
  PublicCinema,
  PublicEvent,
  PublicHomeResponse,
  PublicLocationService,
  PublicMediaAsset,
  PublicMovieSession,
  PublicPage,
  PublicPageBlock,
  PublicPopup,
  PublicSeoMeta,
  PublicSlider,
  PublicStore,
} from './public-response.types';

// ── Shared Prisma select shapes ──────────────────────────────────────────────

const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  mimeType: true,
  altText: true,
  caption: true,
  width: true,
  height: true,
  dominantColor: true,
} as const;

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PublicContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: TranslationResolverService,
  ) {}

  // ── Sliders ──────────────────────────────────────────────────────────────

  async getSliders(opts: {
    tenantId: string;
    mallId?: string;
    placement?: string;
    entityId?: string;
    channel?: string;
    limit?: number;
    localeId?: string;
    /** @deprecated No longer filtered; kept for query compat */
    targetDevice?: string;
  }): Promise<PublicSlider[]> {
    const now = new Date();
    const rows = await this.prisma.slider.findMany({
      where: {
        tenantId: opts.tenantId,
        deletedAt: null,
        status: 'PUBLISHED',
        ...(opts.mallId !== undefined ? { mallId: opts.mallId } : {}),
        ...(opts.placement
          ? {
              placementType:
                opts.placement as Prisma.EnumSliderPlacementTypeFilter['equals'],
            }
          : {}),
        ...(opts.entityId ? { linkedEntityId: opts.entityId } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(opts.channel ? { channels: { has: opts.channel as any } } : {}),
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      include: {
        items: {
          where: { deletedAt: null, status: 'PUBLISHED' },
          include: {
            desktopMedia: { select: MEDIA_SELECT },
            mobileMedia: { select: MEDIA_SELECT },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
      take: opts.limit ?? 10,
    });

    let sliders = rows.map(mapSliderGroup);
    if (!opts.localeId || sliders.length === 0) return sliders;

    const groupIds = sliders.map((s) => s.id);
    const itemIds = sliders.flatMap((s) => s.items.map((i) => i.id));

    const [groupTMap, itemTMap] = await Promise.all([
      this.resolver.getTranslationsForEntities(opts.tenantId, opts.localeId, 'SLIDER', groupIds),
      itemIds.length > 0
        ? this.resolver.getTranslationsForEntities(
            opts.tenantId,
            opts.localeId,
            'SLIDER_ITEM',
            itemIds,
          )
        : Promise.resolve({}),
    ]);

    sliders = sliders.map((s) => {
      const withGroup = this.applyFromMap(s, groupTMap, s.id, ['title']);
      const items = withGroup.items.map((item) =>
        this.applyFromMap(item, itemTMap, item.id, ['title', 'description', 'buttonText']),
      );
      return applySliderLegacyFields({ ...withGroup, items });
    });

    return sliders;
  }

  // ── Events ───────────────────────────────────────────────────────────────

  async getEvents(opts: {
    tenantId: string;
    mallId?: string;
    category?: string;
    search?: string;
    limit?: number;
    localeId?: string;
  }): Promise<PublicEvent[]> {
    const now = new Date();
    const mallScope: Prisma.EventWhereInput =
      opts.mallId !== undefined
        ? { OR: [{ mallId: opts.mallId }, { mallId: null }] }
        : {};

    const rows = await this.prisma.event.findMany({
      where: {
        tenantId: opts.tenantId,
        deletedAt: null,
        status: 'PUBLISHED',
        ...mallScope,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
        ...(opts.category ? { category: opts.category } : {}),
        ...(opts.search
          ? { title: { contains: opts.search, mode: 'insensitive' as const } }
          : {}),
      },
      include: { coverMedia: { select: MEDIA_SELECT } },
      orderBy: [{ sortOrder: 'asc' }, { startAt: 'asc' }],
      take: opts.limit ?? 20,
    });

    const events = rows.map(mapEvent);
    if (!opts.localeId || events.length === 0) return events;

    const tMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      opts.localeId,
      'EVENT',
      events.map((e) => e.id),
    );
    return events.map((e) =>
      this.applyFromMap(e, tMap, e.id, [
        'title',
        'shortDescription',
        'description',
        'buttonText',
      ]),
    );
  }

  async getEventBySlug(opts: {
    tenantId: string;
    mallId?: string;
    slug: string;
    localeId?: string;
  }): Promise<PublicEvent | null> {
    const now = new Date();
    const mallScope: Prisma.EventWhereInput =
      opts.mallId !== undefined
        ? { OR: [{ mallId: opts.mallId }, { mallId: null }] }
        : {};

    const row = await this.prisma.event.findFirst({
      where: {
        tenantId: opts.tenantId,
        slug: opts.slug,
        deletedAt: null,
        status: 'PUBLISHED',
        ...mallScope,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      include: { coverMedia: { select: MEDIA_SELECT } },
    });
    if (!row) return null;

    const event = mapEvent(row);
    if (!opts.localeId) return event;

    const tMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      opts.localeId,
      'EVENT',
      [event.id],
    );
    return this.applyFromMap(event, tMap, event.id, [
      'title',
      'shortDescription',
      'description',
      'buttonText',
    ]);
  }

  // ── Campaigns ────────────────────────────────────────────────────────────

  async getCampaigns(opts: {
    tenantId: string;
    mallId?: string;
    storeId?: string;
    search?: string;
    limit?: number;
    localeId?: string;
  }): Promise<PublicCampaign[]> {
    const now = new Date();
    const mallScope: Prisma.CampaignWhereInput =
      opts.mallId !== undefined
        ? { OR: [{ mallId: opts.mallId }, { mallId: null }] }
        : {};

    const rows = await this.prisma.campaign.findMany({
      where: {
        tenantId: opts.tenantId,
        deletedAt: null,
        status: 'PUBLISHED',
        ...mallScope,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
        ...(opts.storeId ? { storeId: opts.storeId } : {}),
        ...(opts.search
          ? { title: { contains: opts.search, mode: 'insensitive' as const } }
          : {}),
      },
      include: {
        coverMedia: { select: MEDIA_SELECT },
        store: {
          select: {
            id: true,
            localName: true,
            globalStore: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { startAt: 'asc' }],
      take: opts.limit ?? 20,
    });

    const campaigns = rows.map(mapCampaign);
    if (!opts.localeId || campaigns.length === 0) return campaigns;

    const tMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      opts.localeId,
      'CAMPAIGN',
      campaigns.map((c) => c.id),
    );
    return campaigns.map((c) =>
      this.applyFromMap(c, tMap, c.id, [
        'title',
        'shortDescription',
        'description',
        'terms',
        'buttonText',
      ]),
    );
  }

  async getCampaignBySlug(opts: {
    tenantId: string;
    mallId?: string;
    slug: string;
    localeId?: string;
  }): Promise<PublicCampaign | null> {
    const now = new Date();
    const mallScope: Prisma.CampaignWhereInput =
      opts.mallId !== undefined
        ? { OR: [{ mallId: opts.mallId }, { mallId: null }] }
        : {};

    const row = await this.prisma.campaign.findFirst({
      where: {
        tenantId: opts.tenantId,
        slug: opts.slug,
        deletedAt: null,
        status: 'PUBLISHED',
        ...mallScope,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      include: {
        coverMedia: { select: MEDIA_SELECT },
        store: {
          select: {
            id: true,
            localName: true,
            globalStore: { select: { name: true, slug: true } },
          },
        },
      },
    });
    if (!row) return null;

    const campaign = mapCampaign(row);
    if (!opts.localeId) return campaign;

    const tMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      opts.localeId,
      'CAMPAIGN',
      [campaign.id],
    );
    return this.applyFromMap(campaign, tMap, campaign.id, [
      'title',
      'shortDescription',
      'description',
      'terms',
      'buttonText',
    ]);
  }

  // ── Stores ───────────────────────────────────────────────────────────────

  async getStores(opts: {
    tenantId: string;
    mallId: string;
    categoryId?: string;
    search?: string;
    featuredOnly?: boolean;
    limit?: number;
    localeId?: string;
  }): Promise<PublicStore[]> {
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
            ...(opts.search
              ? {
                  OR: [
                    { name: { contains: opts.search, mode: 'insensitive' as const } },
                    { description: { contains: opts.search, mode: 'insensitive' as const } },
                  ],
                }
              : {}),
          },
        },
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
      take: opts.limit ?? 50,
    });

    const stores = rows.map(mapStore);
    if (!opts.localeId || stores.length === 0) return stores;

    const tMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      opts.localeId,
      'STORE',
      stores.map((s) => s.id),
    );
    return stores.map((s) => this.applyFromMap(s, tMap, s.id, ['name', 'description']));
  }

  async getStoreBySlug(opts: {
    tenantId: string;
    mallId: string;
    slug: string;
    localeId?: string;
  }): Promise<PublicStore | null> {
    const row = await this.prisma.mallStore.findFirst({
      where: {
        tenantId: opts.tenantId,
        mallId: opts.mallId,
        deletedAt: null,
        status: 'ACTIVE',
        globalStore: { is: { slug: opts.slug, deletedAt: null, status: 'ACTIVE' } },
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
    });
    if (!row) return null;

    const store = mapStore(row);
    if (!opts.localeId) return store;

    const tMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      opts.localeId,
      'STORE',
      [store.id],
    );
    return this.applyFromMap(store, tMap, store.id, ['name', 'description']);
  }

  // ── Pages ────────────────────────────────────────────────────────────────

  async getPageBySlug(opts: {
    tenantId: string;
    mallId?: string;
    slug: string;
    localeId?: string;
    localeCode?: string;
  }): Promise<PublicPage | null> {
    const now = new Date();
    const mallScope: Prisma.PageWhereInput =
      opts.mallId !== undefined
        ? { OR: [{ mallId: opts.mallId }, { mallId: null }] }
        : {};

    const row = await this.prisma.page.findFirst({
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
        attachments: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: { media: { select: MEDIA_SELECT } },
        },
        blocks: {
          where: { deletedAt: null, status: 'ACTIVE' },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, type: true, title: true, dataJson: true, sortOrder: true },
        },
      },
    });
    if (!row) return null;

    const page = mapPage(row, opts.localeCode ?? null);
    if (!opts.localeId) return page;

    const blockIds = page.blocks.map((b) => b.id);
    const [pageTMap, blockTMap] = await Promise.all([
      this.resolver.getTranslationsForEntities(opts.tenantId, opts.localeId, 'PAGE', [page.id]),
      blockIds.length > 0
        ? this.resolver.getTranslationsForEntities(
            opts.tenantId,
            opts.localeId,
            'PAGE_BLOCK',
            blockIds,
          )
        : Promise.resolve<EntityTranslationMap>({}),
    ]);

    const translatedPage = this.applyFromMap(page, pageTMap, page.id, [
      'title',
      'customTypeLabel',
      'contentHtml',
      'seoTitle',
      'seoDescription',
    ]);
    return {
      ...translatedPage,
      blocks: page.blocks.map((b) => this.applyBlockFromMap(b, blockTMap)),
    } as PublicPage;
  }

  // ── Cinema ───────────────────────────────────────────────────────────────

  async getCinemas(opts: {
    tenantId: string;
    mallId: string;
    localeId?: string;
  }): Promise<PublicCinema[]> {
    const rows = await this.prisma.cinema.findMany({
      where: {
        tenantId: opts.tenantId,
        mallId: opts.mallId,
        deletedAt: null,
        status: 'ACTIVE',
      },
      include: { logoMedia: { select: MEDIA_SELECT } },
      orderBy: { name: 'asc' },
    });

    const cinemas = rows.map(mapCinema);
    if (!opts.localeId || cinemas.length === 0) return cinemas;

    const tMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      opts.localeId,
      'CINEMA',
      cinemas.map((c) => c.id),
    );
    return cinemas.map((c) => this.applyFromMap(c, tMap, c.id, ['description']));
  }

  // ── Movie Sessions ────────────────────────────────────────────────────────

  async getMovieSessions(opts: {
    tenantId: string;
    mallId: string;
    cinemaId?: string;
    movieId?: string;
    date?: string;
    limit?: number;
    localeId?: string;
  }): Promise<PublicMovieSession[]> {
    const dayStart = opts.date ? new Date(opts.date) : undefined;
    let dayEnd: Date | undefined;
    if (dayStart) {
      dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    }

    const rows = await this.prisma.movieSession.findMany({
      where: {
        tenantId: opts.tenantId,
        mallId: opts.mallId,
        deletedAt: null,
        status: 'SCHEDULED',
        cinema: { deletedAt: null, status: 'ACTIVE' },
        movie: { deletedAt: null, status: 'ACTIVE' },
        ...(opts.cinemaId ? { cinemaId: opts.cinemaId } : {}),
        ...(opts.movieId ? { movieId: opts.movieId } : {}),
        ...(dayStart && dayEnd ? { startsAt: { gte: dayStart, lt: dayEnd } } : {}),
      },
      include: {
        cinema: { select: { id: true, name: true, slug: true } },
        movie: { select: { id: true, title: true, slug: true, durationMinutes: true } },
      },
      orderBy: { startsAt: 'asc' },
      take: opts.limit ?? 50,
    });

    const sessions = rows.map(mapMovieSession);
    if (!opts.localeId || sessions.length === 0) return sessions;

    const movieIds = [...new Set(sessions.map((s) => s.movie.id))];
    const movieTMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      opts.localeId,
      'MOVIE',
      movieIds,
    );

    return sessions.map((s) => {
      const mt = movieTMap[s.movie.id];
      if (!mt?.title) return s;
      return { ...s, movie: { ...s.movie, title: mt.title } };
    });
  }

  // ── Home aggregation ─────────────────────────────────────────────────────

  async getHome(opts: {
    tenantId: string;
    mallId?: string;
    localeId?: string;
    localeCode?: string;
    defaultLocaleCode?: string;
  }): Promise<PublicHomeResponse> {
    const todayStr = new Date().toISOString().split('T')[0];

    const [sliders, upcomingEvents, activeCampaigns, featuredStores, todayMovieSessions] =
      await Promise.all([
        this.getSliders({
          tenantId: opts.tenantId,
          mallId: opts.mallId,
          placement: 'HOME',
          limit: 10,
          localeId: opts.localeId,
        }),
        this.getEvents({
          tenantId: opts.tenantId,
          mallId: opts.mallId,
          limit: 6,
          localeId: opts.localeId,
        }),
        this.getCampaigns({
          tenantId: opts.tenantId,
          mallId: opts.mallId,
          limit: 6,
          localeId: opts.localeId,
        }),
        opts.mallId
          ? this.getStores({
              tenantId: opts.tenantId,
              mallId: opts.mallId,
              featuredOnly: true,
              limit: 12,
              localeId: opts.localeId,
            })
          : Promise.resolve([]),
        opts.mallId
          ? this.getMovieSessions({
              tenantId: opts.tenantId,
              mallId: opts.mallId,
              date: todayStr,
              limit: 10,
              localeId: opts.localeId,
            })
          : Promise.resolve([]),
      ]);

    return {
      locale: opts.localeCode ?? null,
      defaultLocale: opts.defaultLocaleCode ?? null,
      sliders,
      upcomingEvents,
      activeCampaigns,
      featuredStores,
      todayMovieSessions,
    };
  }

  // ── Popups ────────────────────────────────────────────────────────────────

  async getPopups(opts: {
    tenantId: string;
    mallId?: string;
    channel?: string;
    localeId?: string;
  }): Promise<PublicPopup[]> {
    const now = new Date();
    const rows = await this.prisma.popup.findMany({
      where: {
        tenantId: opts.tenantId,
        deletedAt: null,
        status: 'PUBLISHED',
        ...(opts.mallId !== undefined ? { mallId: opts.mallId } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(opts.channel ? { channels: { has: opts.channel as any } } : {}),
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      include: { imageMedia: { select: MEDIA_SELECT } },
      orderBy: { sortOrder: 'asc' },
    });

    const popups = rows.map(mapPopup);
    if (!opts.localeId || popups.length === 0) return popups;

    const tMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      opts.localeId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'POPUP' as any,
      popups.map((p) => p.id),
    );
    return popups.map((p) =>
      this.applyFromMap(p, tMap, p.id, ['title', 'description', 'buttonText']),
    );
  }

  // ── Location Services ─────────────────────────────────────────────────────

  async getLocationServiceById(opts: {
    tenantId: string;
    id: string;
  }): Promise<PublicLocationService | null> {
    const row = await this.prisma.service.findFirst({
      where: { id: opts.id, tenantId: opts.tenantId, deletedAt: null, status: 'ACTIVE' },
      include: {
        iconMedia: { select: MEDIA_SELECT },
        coverMedia: { select: MEDIA_SELECT },
      },
    });
    if (!row) return null;
    return mapLocationService(row);
  }

  async getLocationServices(opts: {
    tenantId: string;
    mallId: string;
    localeId?: string;
  }): Promise<PublicLocationService[]> {
    const rows = await this.prisma.service.findMany({
      where: {
        tenantId: opts.tenantId,
        mallId: opts.mallId,
        deletedAt: null,
        status: 'ACTIVE',
      },
      include: {
        iconMedia: { select: MEDIA_SELECT },
        coverMedia: { select: MEDIA_SELECT },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const services = rows.map(mapLocationService);
    if (!opts.localeId || services.length === 0) return services;

    const tMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      opts.localeId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'SERVICE' as any,
      services.map((s) => s.id),
    );
    return services.map((s) =>
      this.applyFromMap(s, tMap, s.id, ['name', 'description', 'locationLabel']),
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private applyFromMap<T extends object>(
    obj: T,
    map: EntityTranslationMap,
    entityId: string,
    fields: readonly string[],
  ): T {
    const t = map[entityId];
    if (!t) return obj;
    const result = { ...obj } as Record<string, unknown>;
    for (const field of fields) {
      if (t[field] !== undefined) result[field] = t[field];
    }
    return result as unknown as T;
  }

  private applyBlockFromMap(block: PublicPageBlock, map: EntityTranslationMap): PublicPageBlock {
    const t = map[block.id];
    if (!t) return block;

    let result: PublicPageBlock = { ...block };
    if (t.title !== undefined) result = { ...result, title: t.title };

    const DATA_FIELDS = ['title', 'subtitle', 'buttonText', 'text', 'html'] as const;
    const hasDataJsonTranslation = DATA_FIELDS.some((f) => t[`dataJson.${f}`] !== undefined);

    if (
      hasDataJsonTranslation &&
      typeof block.dataJson === 'object' &&
      block.dataJson !== null &&
      !Array.isArray(block.dataJson)
    ) {
      const newDataJson: Record<string, unknown> = {
        ...(block.dataJson as Record<string, unknown>),
      };
      for (const f of DATA_FIELDS) {
        const val = t[`dataJson.${f}`];
        if (val !== undefined) newDataJson[f] = val;
      }
      result = { ...result, dataJson: newDataJson };
    }

    return result;
  }
}

// ── Response Mappers ──────────────────────────────────────────────────────────

type RichMediaRow = {
  id: string;
  publicUrl: string;
  mimeType?: string | null;
  altText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  dominantColor?: string | null;
} | null;

function toMediaAsset(
  m: RichMediaRow,
  overrides?: { width?: number | null; height?: number | null },
): PublicMediaAsset | null {
  if (!m) return null;
  return {
    id: m.id,
    url: m.publicUrl,
    mimeType: m.mimeType ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
    widthOverride: overrides?.width ?? null,
    heightOverride: overrides?.height ?? null,
    alt: m.altText ?? null,
    caption: m.caption ?? null,
    dominantColor: m.dominantColor ?? null,
  };
}

function toDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function buildSeo(opts: {
  title: string | null;
  description: string | null;
  keywords?: string[] | null;
  image?: string | null;
  locale?: string | null;
}): PublicSeoMeta {
  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords ?? null,
    image: opts.image ?? null,
    canonicalUrl: null,
    locale: opts.locale ?? null,
  };
}

function mapSliderItem(item: {
  id: string;
  title: string | null;
  description: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  sortOrder: number;
  status: string;
  desktopMedia: RichMediaRow;
  mobileMedia: RichMediaRow;
  desktopMediaWidthOverride?: number | null;
  desktopMediaHeightOverride?: number | null;
  mobileMediaWidthOverride?: number | null;
  mobileMediaHeightOverride?: number | null;
}): PublicSlider['items'][number] {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    buttonText: item.buttonText,
    linkUrl: item.linkUrl,
    desktopMedia: toMediaAsset(item.desktopMedia, {
      width: item.desktopMediaWidthOverride,
      height: item.desktopMediaHeightOverride,
    }),
    mobileMedia: toMediaAsset(item.mobileMedia, {
      width: item.mobileMediaWidthOverride,
      height: item.mobileMediaHeightOverride,
    }),
    sortOrder: item.sortOrder,
    status: item.status,
  };
}

function mapSliderGroup(s: {
  id: string;
  title: string;
  placementType: string;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  sortOrder: number;
  startAt: Date | null;
  endAt: Date | null;
  items: Array<{
    id: string;
    title: string | null;
    description: string | null;
    buttonText: string | null;
    linkUrl: string | null;
    sortOrder: number;
    status: string;
    desktopMedia: RichMediaRow;
    mobileMedia: RichMediaRow;
    desktopMediaWidthOverride?: number | null;
    desktopMediaHeightOverride?: number | null;
    mobileMediaWidthOverride?: number | null;
    mobileMediaHeightOverride?: number | null;
  }>;
}): PublicSlider {
  const items = s.items.map(mapSliderItem);
  return applySliderLegacyFields({
    id: s.id,
    title: s.title,
    placementType: s.placementType,
    linkedEntityType: s.linkedEntityType,
    linkedEntityId: s.linkedEntityId,
    sortOrder: s.sortOrder,
    startAt: toDate(s.startAt),
    endAt: toDate(s.endAt),
    items,
  });
}

function applySliderLegacyFields(
  slider: Omit<
    PublicSlider,
    | 'subtitle'
    | 'description'
    | 'desktopMedia'
    | 'mobileMedia'
    | 'videoMedia'
    | 'linkType'
    | 'linkValue'
    | 'buttonText'
    | 'targetDevice'
  >,
): PublicSlider {
  const first = slider.items[0];
  return {
    ...slider,
    subtitle: null,
    description: first?.description ?? null,
    desktopMedia: first?.desktopMedia ?? null,
    mobileMedia: first?.mobileMedia ?? null,
    videoMedia: null,
    linkType: first?.linkUrl ? 'EXTERNAL_URL' : 'NONE',
    linkValue: first?.linkUrl ?? null,
    buttonText: first?.buttonText ?? null,
    targetDevice: 'ALL',
  };
}

function mapEvent(e: {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  coverMedia: RichMediaRow;
  coverMediaWidthOverride?: number | null;
  coverMediaHeightOverride?: number | null;
  startAt: Date | null;
  endAt: Date | null;
  location: string | null;
  category: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  sortOrder: number;
  publishedAt: Date | null;
}): PublicEvent {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    shortDescription: e.shortDescription,
    description: e.description,
    coverMedia: toMediaAsset(e.coverMedia, {
      width: e.coverMediaWidthOverride,
      height: e.coverMediaHeightOverride,
    }),
    startAt: toDate(e.startAt),
    endAt: toDate(e.endAt),
    location: e.location,
    category: e.category,
    buttonText: e.buttonText,
    linkUrl: e.linkUrl,
    sortOrder: e.sortOrder,
    publishedAt: toDate(e.publishedAt),
    seo: buildSeo({
      title: e.title,
      description: e.shortDescription,
      keywords: e.category ? [e.category] : null,
      image: e.coverMedia?.publicUrl ?? null,
    }),
  };
}

function mapCampaign(c: {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  coverMedia: RichMediaRow;
  coverMediaWidthOverride?: number | null;
  coverMediaHeightOverride?: number | null;
  startAt: Date | null;
  endAt: Date | null;
  terms: string | null;
  couponCode: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  sortOrder: number;
  publishedAt: Date | null;
  store: {
    id: string;
    localName: string | null;
    globalStore: { name: string; slug: string };
  } | null;
}): PublicCampaign {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    shortDescription: c.shortDescription,
    description: c.description,
    coverMedia: toMediaAsset(c.coverMedia, {
      width: c.coverMediaWidthOverride,
      height: c.coverMediaHeightOverride,
    }),
    startAt: toDate(c.startAt),
    endAt: toDate(c.endAt),
    terms: c.terms,
    couponCode: c.couponCode,
    buttonText: c.buttonText,
    linkUrl: c.linkUrl,
    sortOrder: c.sortOrder,
    publishedAt: toDate(c.publishedAt),
    store: c.store
      ? {
          id: c.store.id,
          name: c.store.localName ?? c.store.globalStore.name,
          slug: c.store.globalStore.slug,
        }
      : null,
    seo: buildSeo({
      title: c.title,
      description: c.shortDescription,
      image: c.coverMedia?.publicUrl ?? null,
    }),
  };
}

function mapPage(
  p: {
    id: string;
    slug: string;
    title: string;
    type: string;
    customTypeLabel: string | null;
    contentHtml: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    seoKeywords: string | null;
    publishedAt: Date | null;
    attachments: Array<{
      id: string;
      title: string | null;
      description: string | null;
      mediaId: string;
      sortOrder: number;
      downloadable: boolean;
      media: RichMediaRow;
    }>;
    blocks: Array<{
      id: string;
      type: string;
      title: string | null;
      dataJson: Prisma.JsonValue;
      sortOrder: number;
    }>;
  },
  localeCode: string | null,
): PublicPage {
  const keywords = p.seoKeywords
    ? p.seoKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    : null;

  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    type: p.type,
    customTypeLabel: p.customTypeLabel,
    contentHtml: p.contentHtml,
    renderMode:
      p.attachments.length === 1 && p.attachments[0].media?.mimeType === 'application/pdf'
        ? 'SINGLE_PDF'
        : p.attachments.length > 0
          ? 'DOCUMENT_LIST'
          : 'HTML',
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    seoKeywords: p.seoKeywords,
    publishedAt: toDate(p.publishedAt),
    attachments: p.attachments.map((attachment) => ({
      id: attachment.id,
      title: attachment.title,
      description: attachment.description,
      mediaId: attachment.mediaId,
      sortOrder: attachment.sortOrder,
      downloadable: attachment.downloadable,
      media: toMediaAsset(attachment.media),
    })),
    blocks: p.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      title: b.title,
      dataJson: b.dataJson,
      sortOrder: b.sortOrder,
    })),
    seo: buildSeo({
      title: p.seoTitle ?? p.title,
      description: p.seoDescription,
      keywords: keywords && keywords.length > 0 ? keywords : null,
      locale: localeCode,
    }),
  };
}

function mapStore(r: {
  id: string;
  mallId: string;
  localName: string | null;
  localDescription: string | null;
  floor: string | null;
  storeNo: string | null;
  phone: string | null;
  email: string | null;
  workingHoursJson: Prisma.JsonValue;
  locationJson: Prisma.JsonValue;
  isFeatured: boolean;
  isSoon: boolean;
  searchTags: string[];
  sortOrder: number;
  categoryLinks: { storeCategory: { id: string; name: string; slug: string } }[];
  globalStore: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    phone: string | null;
    email: string | null;
    websiteUrl: string | null;
    logoMedia: RichMediaRow;
  };
}): PublicStore {
  const resolvedName = r.localName ?? r.globalStore.name;
  const resolvedDesc = r.localDescription ?? r.globalStore.description;
  const logo = toMediaAsset(r.globalStore.logoMedia);
  const categories = r.categoryLinks.map((link) => link.storeCategory);
  const phone = r.globalStore.phone ?? r.phone;
  const email = r.globalStore.email ?? r.email;

  return {
    id: r.id,
    mallId: r.mallId,
    name: resolvedName,
    description: resolvedDesc,
    floor: r.floor,
    storeNo: r.storeNo,
    phone,
    email,
    workingHoursJson: r.workingHoursJson,
    locationJson: r.locationJson,
    isFeatured: r.isFeatured,
    isSoon: r.isSoon,
    searchTags: r.searchTags,
    sortOrder: r.sortOrder,
    logo,
    globalStore: {
      id: r.globalStore.id,
      name: r.globalStore.name,
      slug: r.globalStore.slug,
      description: r.globalStore.description,
      phone: r.globalStore.phone,
      email: r.globalStore.email,
      websiteUrl: r.globalStore.websiteUrl,
      logo,
    },
    categories,
    category: categories[0] ?? null,
    seo: buildSeo({
      title: resolvedName,
      description: resolvedDesc,
      image: logo?.url ?? null,
    }),
  };
}

function mapCinema(c: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoMedia: RichMediaRow;
}): PublicCinema {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    logo: toMediaAsset(c.logoMedia),
  };
}

function mapMovieSession(s: {
  id: string;
  cinema: { id: string; name: string; slug: string };
  movie: { id: string; title: string; slug: string; durationMinutes: number | null };
  hallName: string | null;
  startsAt: Date;
  endsAt: Date | null;
  language: string | null;
  subtitle: string | null;
  format: string | null;
  ticketUrl: string | null;
}): PublicMovieSession {
  return {
    id: s.id,
    cinema: s.cinema,
    movie: s.movie,
    hallName: s.hallName,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt ? s.endsAt.toISOString() : null,
    language: s.language,
    subtitle: s.subtitle,
    format: s.format,
    ticketUrl: s.ticketUrl,
  };
}

function mapPopup(r: {
  id: string;
  title: string;
  description: string | null;
  imageMedia: RichMediaRow | null;
  imageMediaWidthOverride?: number | null;
  imageMediaHeightOverride?: number | null;
  linkUrl: string | null;
  buttonText: string | null;
  channels: string[];
  showOnce: boolean;
  closable: boolean;
  startAt: Date | null;
  endAt: Date | null;
  sortOrder: number;
}): PublicPopup {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    image: toMediaAsset(r.imageMedia, {
      width: r.imageMediaWidthOverride,
      height: r.imageMediaHeightOverride,
    }),
    linkUrl: r.linkUrl,
    buttonText: r.buttonText,
    channels: r.channels,
    showOnce: r.showOnce,
    closable: r.closable,
    startAt: r.startAt ? r.startAt.toISOString() : null,
    endAt: r.endAt ? r.endAt.toISOString() : null,
    sortOrder: r.sortOrder,
  };
}

function mapLocationService(r: {
  id: string;
  mallId: string;
  name: string;
  description: string | null;
  iconMedia: RichMediaRow | null;
  coverMedia: RichMediaRow | null;
  iconMediaWidthOverride?: number | null;
  iconMediaHeightOverride?: number | null;
  coverMediaWidthOverride?: number | null;
  coverMediaHeightOverride?: number | null;
  category: string | null;
  floor: string | null;
  unitNo: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  searchTags: string[];
  isSoon: boolean;
  sortOrder: number;
}): PublicLocationService {
  return {
    id: r.id,
    mallId: r.mallId,
    name: r.name,
    description: r.description,
    icon: toMediaAsset(r.iconMedia, {
      width: r.iconMediaWidthOverride,
      height: r.iconMediaHeightOverride,
    }),
    cover: toMediaAsset(r.coverMedia, {
      width: r.coverMediaWidthOverride,
      height: r.coverMediaHeightOverride,
    }),
    category: r.category,
    floor: r.floor,
    unitNo: r.unitNo,
    phone: r.phone,
    email: r.email,
    websiteUrl: r.websiteUrl,
    locationLabel: r.locationLabel,
    latitude: r.latitude,
    longitude: r.longitude,
    searchTags: r.searchTags,
    isSoon: r.isSoon,
    sortOrder: r.sortOrder,
  };
}
