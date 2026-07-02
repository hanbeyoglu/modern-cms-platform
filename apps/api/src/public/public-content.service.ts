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
import type { PaginatedItems } from './public-pagination.util';
import {
  parseStoreSocialLinks,
  type StoreSocialLink,
} from '../common/types/store-social-link';
import {
  resolveSliderItemMedia,
  resolveSliderItemText,
  type SliderItemTranslationRow,
} from '../sliders/slider-media.util.js';
import {
  resolveContentCoverImage,
  pickLocalizedField,
  type ContentTranslationRow,
} from '../common/utils/content-cover-media.util.js';
import {
  resolveCampaignMedia,
  type CampaignTranslationMediaRow,
} from '../campaigns/campaign-media.util.js';

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

const PUBLISH_WINDOW_FILTER = (now: Date) => ({
  AND: [
    { OR: [{ publishStartAt: null }, { publishStartAt: { lte: now } }] },
    { OR: [{ publishEndAt: null }, { publishEndAt: { gte: now } }] },
  ],
});

const EVENT_PUBLIC_INCLUDE = {
  sharedCoverImage: { select: MEDIA_SELECT },
  translations: {
    include: {
      coverImage: { select: MEDIA_SELECT },
    },
  },
} satisfies Prisma.EventInclude;

const CAMPAIGN_PUBLIC_INCLUDE = {
  sharedCoverImage: { select: MEDIA_SELECT },
  sharedMobileCoverImage: { select: MEDIA_SELECT },
  translations: {
    include: {
      coverImage: { select: MEDIA_SELECT },
      mobileCoverImage: { select: MEDIA_SELECT },
    },
  },
  store: {
    select: {
      id: true,
      detailTitle: true,
      globalStore: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.CampaignInclude;

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
    defaultLocaleId?: string | null;
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
            sharedImage: { select: MEDIA_SELECT },
            sharedMobileImage: { select: MEDIA_SELECT },
            translations: {
              include: {
                image: { select: MEDIA_SELECT },
                mobileImage: { select: MEDIA_SELECT },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
      take: opts.limit ?? 10,
    });

    const localeId = opts.localeId ?? null;
    const defaultLocaleId = opts.defaultLocaleId ?? null;

    let sliders = rows.map((s) => mapSliderGroup(s, localeId, defaultLocaleId));
    if (!localeId || sliders.length === 0) return sliders;

    const groupIds = sliders.map((s) => s.id);
    const groupTMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      localeId,
      'SLIDER',
      groupIds,
    );

    sliders = sliders.map((s) =>
      applySliderLegacyFields(this.applyFromMap(s, groupTMap, s.id, ['title'])),
    );

    return sliders;
  }

  // ── Events ───────────────────────────────────────────────────────────────

  async getEvents(opts: {
    tenantId: string;
    mallId?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
    localeId?: string;
    defaultLocaleId?: string | null;
  }): Promise<PaginatedItems<PublicEvent>> {
    const now = new Date();
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;
    const mallScope: Prisma.EventWhereInput =
      opts.mallId !== undefined
        ? { OR: [{ mallId: opts.mallId }, { mallId: null }] }
        : {};

    const where: Prisma.EventWhereInput = {
      tenantId: opts.tenantId,
      deletedAt: null,
      status: 'PUBLISHED',
      ...mallScope,
      ...PUBLISH_WINDOW_FILTER(now),
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.search
        ? { title: { contains: opts.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: EVENT_PUBLIC_INCLUDE,
        orderBy: [{ sortOrder: 'asc' }, { eventStartAt: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    const localeId = opts.localeId ?? null;
    const defaultLocaleId = opts.defaultLocaleId ?? null;
    const events = rows.map((row) => mapEvent(row, localeId, defaultLocaleId));
    if (!localeId || events.length === 0) return { items: events, total };

    const tMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      localeId,
      'EVENT',
      events.map((e) => e.id),
    );
    return {
      items: events.map((e) =>
        this.applyFromMap(e, tMap, e.id, [
          'title',
          'shortDescription',
          'description',
          'buttonText',
        ]),
      ),
      total,
    };
  }

  async getEventBySlug(opts: {
    tenantId: string;
    mallId?: string;
    slug: string;
    localeId?: string;
    defaultLocaleId?: string | null;
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
        ...PUBLISH_WINDOW_FILTER(now),
      },
      include: EVENT_PUBLIC_INCLUDE,
    });
    if (!row) return null;

    const event = mapEvent(row, opts.localeId ?? null, opts.defaultLocaleId ?? null);
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
    page?: number;
    limit?: number;
    localeId?: string;
    defaultLocaleId?: string | null;
  }): Promise<PaginatedItems<PublicCampaign>> {
    const now = new Date();
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;
    const mallScope: Prisma.CampaignWhereInput =
      opts.mallId !== undefined
        ? { OR: [{ mallId: opts.mallId }, { mallId: null }] }
        : {};

    const where: Prisma.CampaignWhereInput = {
      tenantId: opts.tenantId,
      deletedAt: null,
      status: 'PUBLISHED',
      ...mallScope,
      ...PUBLISH_WINDOW_FILTER(now),
      ...(opts.storeId ? { storeId: opts.storeId } : {}),
      ...(opts.search
        ? { title: { contains: opts.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({
        where,
        include: CAMPAIGN_PUBLIC_INCLUDE,
        orderBy: [{ sortOrder: 'asc' }, { campaignStartAt: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    const localeId = opts.localeId ?? null;
    const defaultLocaleId = opts.defaultLocaleId ?? null;
    const campaigns = rows.map((row) => mapCampaign(row, localeId, defaultLocaleId));
    if (!localeId || campaigns.length === 0) return { items: campaigns, total };

    const tMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      localeId,
      'CAMPAIGN',
      campaigns.map((c) => c.id),
    );
    return {
      items: campaigns.map((c) =>
        this.applyFromMap(c, tMap, c.id, [
          'title',
          'shortDescription',
          'description',
          'terms',
          'buttonText',
        ]),
      ),
      total,
    };
  }

  async getCampaignBySlug(opts: {
    tenantId: string;
    mallId?: string;
    slug: string;
    localeId?: string;
    defaultLocaleId?: string | null;
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
        ...PUBLISH_WINDOW_FILTER(now),
      },
      include: CAMPAIGN_PUBLIC_INCLUDE,
    });
    if (!row) return null;

    const campaign = mapCampaign(row, opts.localeId ?? null, opts.defaultLocaleId ?? null);
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
    page?: number;
    limit?: number;
    localeId?: string;
    defaultLocaleId?: string | null;
  }): Promise<PaginatedItems<PublicStore>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.MallStoreWhereInput = {
      tenantId: opts.tenantId,
      mallId: opts.mallId,
      deletedAt: null,
      status: 'ACTIVE',
      ...(opts.featuredOnly ? { isFeatured: true } : {}),
      ...(opts.categoryId
        ? { categoryId: opts.categoryId, category: { is: { deletedAt: null, active: true } } }
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
    };

    const [total, rows] = await Promise.all([
      this.prisma.mallStore.count({ where }),
      this.prisma.mallStore.findMany({
        where,
        include: {
          floorRecord: true,
          category: {
            include: {
              iconMedia: { select: MEDIA_SELECT },
              coverMedia: { select: MEDIA_SELECT },
              translations: {
                include: {
                  iconMedia: { select: MEDIA_SELECT },
                  coverMedia: { select: MEDIA_SELECT },
                },
              },
            },
          },
          globalStore: {
            include: {
              logoMedia: { select: MEDIA_SELECT },
            },
          },
        },
        orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { globalStore: { name: 'asc' } }],
        skip,
        take: limit,
      }),
    ]);

    const stores = rows.map((row) =>
      mapStore(row, opts.localeId ?? null, opts.defaultLocaleId ?? null),
    );
    if (!opts.localeId || stores.length === 0) return { items: stores, total };

    const storeIds = stores.map((s) => s.id);
    const categoryIds = [...new Set(stores.map((s) => s.category?.id).filter(Boolean) as string[])];
    const [storeTMap, categoryTMap] = await Promise.all([
      this.resolver.getTranslationsForEntities(opts.tenantId, opts.localeId, 'STORE', storeIds),
      categoryIds.length > 0
        ? this.resolver.getTranslationsForEntities(opts.tenantId, opts.localeId, 'STORE_CATEGORY', categoryIds)
        : Promise.resolve({} as EntityTranslationMap),
    ]);
    return {
      items: stores.map((s) => this.applyStoreLocale(s, storeTMap, categoryTMap, s.id)),
      total,
    };
  }

  async getStoreBySlug(opts: {
    tenantId: string;
    mallId: string;
    slug: string;
    localeId?: string;
    defaultLocaleId?: string | null;
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
        floorRecord: true,
        category: {
          include: {
            iconMedia: { select: MEDIA_SELECT },
            coverMedia: { select: MEDIA_SELECT },
            translations: {
              include: {
                iconMedia: { select: MEDIA_SELECT },
                coverMedia: { select: MEDIA_SELECT },
              },
            },
          },
        },
        globalStore: {
          include: {
            logoMedia: { select: MEDIA_SELECT },
          },
        },
      },
    });
    if (!row) return null;

    const store = mapStore(row, opts.localeId ?? null, opts.defaultLocaleId ?? null);
    if (!opts.localeId) return store;

    const categoryIds = store.category ? [store.category.id] : [];
    const [storeTMap, categoryTMap] = await Promise.all([
      this.resolver.getTranslationsForEntities(opts.tenantId, opts.localeId, 'STORE', [store.id]),
      categoryIds.length > 0
        ? this.resolver.getTranslationsForEntities(opts.tenantId, opts.localeId, 'STORE_CATEGORY', categoryIds)
        : Promise.resolve({} as EntityTranslationMap),
    ]);
    return this.applyStoreLocale(store, storeTMap, categoryTMap, store.id);
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

    const now = new Date();
    const rows = await this.prisma.movieSession.findMany({
      where: {
        tenantId: opts.tenantId,
        mallId: opts.mallId,
        deletedAt: null,
        status: 'SCHEDULED',
        cinema: { deletedAt: null, status: 'ACTIVE' },
        movie: {
          deletedAt: null,
          status: 'ACTIVE',
          AND: [
            { OR: [{ publishStartAt: null }, { publishStartAt: { lte: now } }] },
            { OR: [{ publishEndAt: null }, { publishEndAt: { gte: now } }] },
          ],
        },
        ...(opts.cinemaId ? { cinemaId: opts.cinemaId } : {}),
        ...(opts.movieId ? { movieId: opts.movieId } : {}),
        ...(dayStart && dayEnd ? { startsAt: { gte: dayStart, lt: dayEnd } } : {}),
      },
      include: {
        cinema: { select: { id: true, name: true, slug: true } },
        movie: {
          select: {
            id: true,
            title: true,
            slug: true,
            durationMinutes: true,
            releaseDate: true,
            ticketUrl: true,
            posterMedia: { select: MEDIA_SELECT },
            categories: {
              include: { category: true },
              orderBy: { category: { sortOrder: 'asc' } },
            },
          },
        },
      },
      orderBy: [{ startsAt: 'asc' }, { showDate: 'asc' }, { showTime: 'asc' }],
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
    defaultLocaleId?: string | null;
  }): Promise<PublicHomeResponse> {
    const todayStr = new Date().toISOString().split('T')[0];

    const [sliders, upcomingEventsResult, activeCampaignsResult, featuredStoresResult, todayMovieSessions] =
      await Promise.all([
        this.getSliders({
          tenantId: opts.tenantId,
          mallId: opts.mallId,
          placement: 'HOME',
          limit: 10,
          localeId: opts.localeId,
          defaultLocaleId: opts.defaultLocaleId ?? null,
        }),
        this.getEvents({
          tenantId: opts.tenantId,
          mallId: opts.mallId,
          limit: 6,
          localeId: opts.localeId,
          defaultLocaleId: opts.defaultLocaleId ?? null,
        }),
        this.getCampaigns({
          tenantId: opts.tenantId,
          mallId: opts.mallId,
          limit: 6,
          localeId: opts.localeId,
          defaultLocaleId: opts.defaultLocaleId ?? null,
        }),
        opts.mallId
          ? this.getStores({
              tenantId: opts.tenantId,
              mallId: opts.mallId,
              featuredOnly: true,
              limit: 12,
              localeId: opts.localeId,
            })
          : Promise.resolve({ items: [], total: 0 }),
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
      upcomingEvents: upcomingEventsResult.items,
      activeCampaigns: activeCampaignsResult.items,
      featuredStores: featuredStoresResult.items,
      todayMovieSessions,
    };
  }

  // ── Popups ────────────────────────────────────────────────────────────────

  async getPopups(opts: {
    tenantId: string;
    mallId?: string;
    channel?: string;
    page?: number;
    limit?: number;
    localeId?: string;
  }): Promise<PaginatedItems<PublicPopup>> {
    const now = new Date();
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PopupWhereInput = {
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
    };

    const [total, rows] = await Promise.all([
      this.prisma.popup.count({ where }),
      this.prisma.popup.findMany({
        where,
        include: { imageMedia: { select: MEDIA_SELECT } },
        orderBy: { sortOrder: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const popups = rows.map(mapPopup);
    if (!opts.localeId || popups.length === 0) return { items: popups, total };

    const tMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      opts.localeId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'POPUP' as any,
      popups.map((p) => p.id),
    );
    return {
      items: popups.map((p) =>
        this.applyFromMap(p, tMap, p.id, ['title', 'description', 'buttonText']),
      ),
      total,
    };
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
    search?: string;
    page?: number;
    limit?: number;
    localeId?: string;
  }): Promise<PaginatedItems<PublicLocationService>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceWhereInput = {
      tenantId: opts.tenantId,
      mallId: opts.mallId,
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
    };

    const [total, rows] = await Promise.all([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        include: {
          iconMedia: { select: MEDIA_SELECT },
          coverMedia: { select: MEDIA_SELECT },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    const services = rows.map(mapLocationService);
    if (!opts.localeId || services.length === 0) return { items: services, total };

    const tMap = await this.resolver.getTranslationsForEntities(
      opts.tenantId,
      opts.localeId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'SERVICE' as any,
      services.map((s) => s.id),
    );
    return {
      items: services.map((s) =>
        this.applyFromMap(s, tMap, s.id, ['name', 'description', 'locationLabel']),
      ),
      total,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private applyStoreTranslations(store: PublicStore, map: EntityTranslationMap, entityId: string): PublicStore {
    const t = map[entityId];
    if (!t) return store;
    const detailTitle =
      t.detailTitle !== undefined
        ? t.detailTitle || null
        : t.displayTitle !== undefined
          ? t.displayTitle || null
          : store.detailTitle;
    const description =
      t.localDescription !== undefined ? t.localDescription || null : store.description;
    const seoTitle = detailTitle ?? store.name;
    return {
      ...store,
      detailTitle,
      displayTitle: detailTitle,
      description,
      seo: buildSeo({
        title: seoTitle,
        description: description ?? store.seo.description,
        image: store.seo.image,
        keywords: store.seo.keywords,
        locale: store.seo.locale,
      }),
    };
  }

  private applyStoreLocale(
    store: PublicStore,
    storeMap: EntityTranslationMap,
    categoryMap: EntityTranslationMap,
    entityId: string,
  ): PublicStore {
    let result = this.applyStoreTranslations(store, storeMap, entityId);
    if (!result.category) return result;
    const t = categoryMap[result.category.id];
    if (!t) return result;
    const name = t.name !== undefined ? String(t.name) : result.category.name;
    const description =
      t.description !== undefined ? (t.description ? String(t.description) : null) : result.category.description;
    const category = { ...result.category, name, description };
    return {
      ...result,
      category,
      categories: [{ id: category.id, name: category.name, slug: category.slug }],
    };
  }

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

function toSliderTranslationRows(
  translations: Array<{
    localeId: string;
    title: string | null;
    description: string | null;
    buttonText: string | null;
    image: RichMediaRow;
    mobileImage: RichMediaRow;
  }>,
): SliderItemTranslationRow[] {
  const mapMedia = (m: RichMediaRow) =>
    m
      ? {
          id: m.id,
          publicUrl: m.publicUrl,
          originalName: m.altText ?? '',
          mimeType: m.mimeType ?? '',
          width: m.width,
          height: m.height,
        }
      : null;

  return translations.map((t) => ({
    localeId: t.localeId,
    title: t.title,
    description: t.description,
    buttonText: t.buttonText,
    image: mapMedia(t.image),
    mobileImage: mapMedia(t.mobileImage),
  }));
}

function mapSliderItem(
  item: {
    id: string;
    title: string | null;
    description: string | null;
    buttonText: string | null;
    linkUrl: string | null;
    sortOrder: number;
    status: string;
    sameImageForAllLocales: boolean;
    sharedImage: RichMediaRow;
    sharedMobileImage: RichMediaRow;
    translations: Array<{
      localeId: string;
      title: string | null;
      description: string | null;
      buttonText: string | null;
      image: RichMediaRow;
      mobileImage: RichMediaRow;
    }>;
    desktopMediaWidthOverride?: number | null;
    desktopMediaHeightOverride?: number | null;
    mobileMediaWidthOverride?: number | null;
    mobileMediaHeightOverride?: number | null;
  },
  localeId: string | null,
  defaultLocaleId: string | null,
): PublicSlider['items'][number] {
  const translationRows = toSliderTranslationRows(item.translations);
  const sharedImageRow = item.sharedImage
    ? {
        id: item.sharedImage.id,
        publicUrl: item.sharedImage.publicUrl,
        originalName: item.sharedImage.altText ?? '',
        mimeType: item.sharedImage.mimeType ?? '',
        width: item.sharedImage.width,
        height: item.sharedImage.height,
      }
    : null;
  const sharedMobileRow = item.sharedMobileImage
    ? {
        id: item.sharedMobileImage.id,
        publicUrl: item.sharedMobileImage.publicUrl,
        originalName: item.sharedMobileImage.altText ?? '',
        mimeType: item.sharedMobileImage.mimeType ?? '',
        width: item.sharedMobileImage.width,
        height: item.sharedMobileImage.height,
      }
    : null;

  const resolvedText =
    localeId != null
      ? resolveSliderItemText({
          baseTitle: item.title,
          baseDescription: item.description,
          baseButtonText: item.buttonText,
          localeId,
          defaultLocaleId,
          translations: translationRows,
        })
      : {
          title: item.title,
          description: item.description,
          buttonText: item.buttonText,
        };

  const { desktop, mobile } = resolveSliderItemMedia({
    sameImageForAllLocales: item.sameImageForAllLocales,
    sharedImage: sharedImageRow,
    sharedMobileImage: sharedMobileRow,
    localeId: localeId ?? defaultLocaleId ?? '',
    defaultLocaleId,
    translations: translationRows,
  });

  const desktopMedia = toMediaAsset(
    desktop
      ? {
          id: desktop.id,
          publicUrl: desktop.publicUrl,
          mimeType: desktop.mimeType,
          altText: desktop.originalName,
          width: desktop.width,
          height: desktop.height,
        }
      : null,
    {
      width: item.desktopMediaWidthOverride,
      height: item.desktopMediaHeightOverride,
    },
  );
  const mobileMedia = toMediaAsset(
    mobile
      ? {
          id: mobile.id,
          publicUrl: mobile.publicUrl,
          mimeType: mobile.mimeType,
          altText: mobile.originalName,
          width: mobile.width,
          height: mobile.height,
        }
      : null,
    {
      width: item.mobileMediaWidthOverride,
      height: item.mobileMediaHeightOverride,
    },
  );

  return {
    id: item.id,
    title: resolvedText.title,
    description: resolvedText.description,
    buttonText: resolvedText.buttonText,
    linkUrl: item.linkUrl,
    desktopMedia,
    mobileMedia,
    image: desktopMedia,
    mobileImage: mobileMedia,
    sortOrder: item.sortOrder,
    status: item.status,
  };
}

function mapSliderGroup(
  s: {
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
      sameImageForAllLocales: boolean;
      sharedImage: RichMediaRow;
      sharedMobileImage: RichMediaRow;
      translations: Array<{
        localeId: string;
        title: string | null;
        description: string | null;
        buttonText: string | null;
        image: RichMediaRow;
        mobileImage: RichMediaRow;
      }>;
      desktopMediaWidthOverride?: number | null;
      desktopMediaHeightOverride?: number | null;
      mobileMediaWidthOverride?: number | null;
      mobileMediaHeightOverride?: number | null;
    }>;
  },
  localeId: string | null,
  defaultLocaleId: string | null,
): PublicSlider {
  const items = s.items.map((item) => mapSliderItem(item, localeId, defaultLocaleId));
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

function toCoverMediaRow(media: RichMediaRow): ContentTranslationRow['coverImage'] {
  if (!media) return null;
  return {
    id: media.id,
    publicUrl: media.publicUrl,
    originalName: media.altText ?? '',
    mimeType: media.mimeType ?? '',
    width: media.width,
    height: media.height,
  };
}

function mapEvent(
  e: {
    id: string;
    slug: string;
    title: string;
    shortDescription: string | null;
    description: string | null;
    sameImageForAllLocales: boolean;
    sharedCoverImage: RichMediaRow;
    coverMediaWidthOverride?: number | null;
    coverMediaHeightOverride?: number | null;
    publishStartAt: Date | null;
    publishEndAt: Date | null;
    eventStartAt: Date | null;
    eventEndAt: Date | null;
    location: string | null;
    category: string | null;
    buttonText: string | null;
    linkUrl: string | null;
    sortOrder: number;
    publishedAt: Date | null;
    translations: Array<{
      localeId: string;
      title: string | null;
      description: string | null;
      shortDescription: string | null;
      coverImage: RichMediaRow;
    }>;
  },
  localeId: string | null,
  defaultLocaleId: string | null,
): PublicEvent {
  const translationRows: ContentTranslationRow[] = e.translations.map((t) => ({
    localeId: t.localeId,
    title: t.title,
    description: t.description,
    shortDescription: t.shortDescription,
    coverImage: toCoverMediaRow(t.coverImage),
  }));

  const resolvedText =
    localeId != null
      ? {
          title: pickLocalizedField('title', e.title, localeId, defaultLocaleId, translationRows),
          description: pickLocalizedField('description', e.description, localeId, defaultLocaleId, translationRows),
          shortDescription: pickLocalizedField(
            'shortDescription',
            e.shortDescription,
            localeId,
            defaultLocaleId,
            translationRows,
          ),
          buttonText: pickLocalizedField('buttonText', e.buttonText, localeId, defaultLocaleId, translationRows),
        }
      : {
          title: e.title,
          description: e.description,
          shortDescription: e.shortDescription,
          buttonText: e.buttonText,
        };

  const coverRow = resolveContentCoverImage({
    sameImageForAllLocales: e.sameImageForAllLocales,
    sharedCoverImage: toCoverMediaRow(e.sharedCoverImage),
    localeId: localeId ?? defaultLocaleId ?? '',
    defaultLocaleId,
    translations: translationRows,
  });

  const image = toMediaAsset(
    coverRow
      ? {
          id: coverRow.id,
          publicUrl: coverRow.publicUrl,
          mimeType: coverRow.mimeType,
          altText: coverRow.originalName,
          width: coverRow.width,
          height: coverRow.height,
        }
      : null,
    {
      width: e.coverMediaWidthOverride,
      height: e.coverMediaHeightOverride,
    },
  );

  const eventStartAt = toDate(e.eventStartAt);
  const eventEndAt = toDate(e.eventEndAt);

  return {
    id: e.id,
    slug: e.slug,
    title: resolvedText.title ?? e.title,
    shortDescription: resolvedText.shortDescription ?? e.shortDescription,
    description: resolvedText.description ?? e.description,
    image,
    coverMedia: image,
    publishStartAt: toDate(e.publishStartAt),
    publishEndAt: toDate(e.publishEndAt),
    eventStartAt,
    eventEndAt,
    startAt: eventStartAt,
    endAt: eventEndAt,
    location: e.location,
    category: e.category,
    buttonText: resolvedText.buttonText ?? e.buttonText,
    linkUrl: e.linkUrl,
    sortOrder: e.sortOrder,
    publishedAt: toDate(e.publishedAt),
    seo: buildSeo({
      title: resolvedText.title ?? e.title,
      description: resolvedText.shortDescription ?? e.shortDescription,
      keywords: e.category ? [e.category] : null,
      image: image?.url ?? null,
    }),
  };
}

function mapCampaign(
  c: {
    id: string;
    slug: string;
    title: string;
    shortDescription: string | null;
    description: string | null;
    sameImageForAllLocales: boolean;
    sharedCoverImage: RichMediaRow;
    sharedMobileCoverImage: RichMediaRow;
    coverMediaWidthOverride?: number | null;
    coverMediaHeightOverride?: number | null;
    publishStartAt: Date | null;
    publishEndAt: Date | null;
    campaignStartAt: Date | null;
    campaignEndAt: Date | null;
    terms: string | null;
    couponCode: string | null;
    buttonText: string | null;
    linkUrl: string | null;
    sortOrder: number;
    publishedAt: Date | null;
    translations: Array<{
      localeId: string;
      title: string | null;
      description: string | null;
      buttonText: string | null;
      coverImage: RichMediaRow;
      mobileCoverImage: RichMediaRow;
    }>;
    store: {
      id: string;
      detailTitle: string | null;
      globalStore: { name: string; slug: string };
    } | null;
  },
  localeId: string | null,
  defaultLocaleId: string | null,
): PublicCampaign {
  const translationRows: ContentTranslationRow[] = c.translations.map((t) => ({
    localeId: t.localeId,
    title: t.title,
    description: t.description,
    buttonText: t.buttonText,
    coverImage: toCoverMediaRow(t.coverImage),
  }));

  const mediaTranslationRows: CampaignTranslationMediaRow[] = c.translations.map((t) => ({
    localeId: t.localeId,
    title: t.title,
    description: t.description,
    buttonText: t.buttonText,
    coverImage: toCoverMediaRow(t.coverImage),
    mobileCoverImage: toCoverMediaRow(t.mobileCoverImage),
  }));

  const resolvedText =
    localeId != null
      ? {
          title: pickLocalizedField('title', c.title, localeId, defaultLocaleId, translationRows),
          description: pickLocalizedField('description', c.description, localeId, defaultLocaleId, translationRows),
          buttonText: pickLocalizedField('buttonText', c.buttonText, localeId, defaultLocaleId, translationRows),
        }
      : {
          title: c.title,
          description: c.description,
          buttonText: c.buttonText,
        };

  const { desktop: coverRow, mobile: mobileCoverRow } = resolveCampaignMedia({
    sameImageForAllLocales: c.sameImageForAllLocales,
    sharedCoverImage: toCoverMediaRow(c.sharedCoverImage),
    sharedMobileCoverImage: toCoverMediaRow(c.sharedMobileCoverImage),
    localeId: localeId ?? defaultLocaleId ?? '',
    defaultLocaleId,
    translations: mediaTranslationRows,
  });

  const image = toMediaAsset(
    coverRow
      ? {
          id: coverRow.id,
          publicUrl: coverRow.publicUrl,
          mimeType: coverRow.mimeType,
          altText: coverRow.originalName,
          width: coverRow.width,
          height: coverRow.height,
        }
      : null,
    {
      width: c.coverMediaWidthOverride,
      height: c.coverMediaHeightOverride,
    },
  );

  const mobileImage = toMediaAsset(
    mobileCoverRow
      ? {
          id: mobileCoverRow.id,
          publicUrl: mobileCoverRow.publicUrl,
          mimeType: mobileCoverRow.mimeType,
          altText: mobileCoverRow.originalName,
          width: mobileCoverRow.width,
          height: mobileCoverRow.height,
        }
      : null,
    {
      width: c.coverMediaWidthOverride,
      height: c.coverMediaHeightOverride,
    },
  );

  const campaignStartAt = toDate(c.campaignStartAt);
  const campaignEndAt = toDate(c.campaignEndAt);

  return {
    id: c.id,
    slug: c.slug,
    title: resolvedText.title ?? c.title,
    shortDescription: c.shortDescription,
    description: resolvedText.description ?? c.description,
    image,
    mobileImage,
    coverMedia: image,
    publishStartAt: toDate(c.publishStartAt),
    publishEndAt: toDate(c.publishEndAt),
    campaignStartAt,
    campaignEndAt,
    startAt: campaignStartAt,
    endAt: campaignEndAt,
    terms: c.terms,
    couponCode: c.couponCode,
    buttonText: resolvedText.buttonText ?? c.buttonText,
    linkUrl: c.linkUrl,
    sortOrder: c.sortOrder,
    publishedAt: toDate(c.publishedAt),
    store: c.store
      ? {
          id: c.store.id,
          name: c.store.globalStore.name,
          slug: c.store.globalStore.slug,
        }
      : null,
    seo: buildSeo({
      title: resolvedText.title ?? c.title,
      description: c.shortDescription,
      image: image?.url ?? null,
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

function mapStore(
  r: {
    id: string;
    mallId: string;
    detailTitle: string | null;
    localDescription: string | null;
    floor: string | null;
    floorId: string | null;
    floorRecord: { id: string; name: string; label: string } | null;
    storeNo: string | null;
    phone: string | null;
    whatsappPhone: string | null;
    email: string | null;
    workingHoursJson: Prisma.JsonValue;
    locationJson: Prisma.JsonValue;
    isFeatured: boolean;
    isSoon: boolean;
    searchTags: string[];
    sortOrder: number;
    category: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      color: string | null;
      sameImageForAllLocales: boolean;
      iconMedia: RichMediaRow;
      coverMedia: RichMediaRow;
      translations: {
        localeId: string;
        iconMedia: RichMediaRow;
        coverMedia: RichMediaRow;
      }[];
    } | null;
    globalStore: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      phone: string | null;
      email: string | null;
      websiteUrl: string | null;
      socialLinksJson: Prisma.JsonValue;
      logoMedia: RichMediaRow;
    };
  },
  localeId: string | null,
  defaultLocaleId: string | null,
): PublicStore {
  const detailTitle = r.detailTitle;
  const name = r.globalStore.name;
  const resolvedDesc = r.localDescription ?? r.globalStore.description;
  const logo = toMediaAsset(r.globalStore.logoMedia);
  const category = mapStoreCategory(r.category, localeId, defaultLocaleId);
  const phone = r.phone ?? r.globalStore.phone;
  const email = r.email ?? r.globalStore.email;
  const socialLinks: StoreSocialLink[] = parseStoreSocialLinks(r.globalStore.socialLinksJson);
  const floor = r.floorRecord
    ? { id: r.floorRecord.id, name: r.floorRecord.name, label: r.floorRecord.label }
    : r.floor
      ? { id: r.floorId ?? r.floor, name: r.floor, label: r.floor }
      : null;

  return {
    id: r.id,
    mallId: r.mallId,
    name,
    detailTitle,
    displayTitle: detailTitle,
    description: resolvedDesc,
    floor,
    floorLabel: floor?.label ?? r.floor,
    storeNo: r.storeNo,
    phone,
    whatsappPhone: r.whatsappPhone,
    email,
    workingHours: r.workingHoursJson,
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
      socialLinks,
    },
    categories: category ? [{ id: category.id, name: category.name, slug: category.slug }] : [],
    category,
    seo: buildSeo({
      title: detailTitle ?? name,
      description: resolvedDesc,
      image: logo?.url ?? null,
    }),
  };
}

function mapStoreCategory(
  cat: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    color: string | null;
    sameImageForAllLocales: boolean;
    iconMedia: RichMediaRow;
    coverMedia: RichMediaRow;
    translations: {
      localeId: string;
      iconMedia: RichMediaRow;
      coverMedia: RichMediaRow;
    }[];
  } | null,
  localeId: string | null,
  defaultLocaleId: string | null,
): PublicStore['category'] {
  if (!cat) return null;
  const localeRow =
    localeId != null
      ? (cat.translations.find((t) => t.localeId === localeId) ??
        (defaultLocaleId ? cat.translations.find((t) => t.localeId === defaultLocaleId) : undefined))
      : undefined;
  const iconSource = cat.sameImageForAllLocales ? cat.iconMedia : (localeRow?.iconMedia ?? cat.iconMedia);
  const coverSource = cat.sameImageForAllLocales ? cat.coverMedia : (localeRow?.coverMedia ?? cat.coverMedia);
  return {
    id: cat.id,
    slug: cat.slug,
    name: cat.name,
    description: cat.description,
    color: cat.color,
    icon: toMediaAsset(iconSource),
    cover: toMediaAsset(coverSource),
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
  cinema: { id: string; name: string; slug: string } | null;
  movie: {
    id: string;
    title: string;
    slug: string;
    durationMinutes: number | null;
    releaseDate: Date | null;
    ticketUrl: string | null;
    posterMedia: RichMediaRow;
    categories: Array<{ category: { id: string; name: string; slug: string } }>;
  };
  hallName: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  language: string | null;
  subtitle: string | null;
  format: string | null;
  ticketUrl: string | null;
}): PublicMovieSession {
  return {
    id: s.id,
    cinema: s.cinema ?? { id: '', name: '', slug: '' },
    movie: {
      id: s.movie.id,
      title: s.movie.title,
      slug: s.movie.slug,
      durationMinutes: s.movie.durationMinutes,
      releaseDate: s.movie.releaseDate ? s.movie.releaseDate.toISOString() : null,
      ticketUrl: s.movie.ticketUrl,
      poster: toMediaAsset(s.movie.posterMedia),
      categories: s.movie.categories.map((item) => item.category),
    },
    hallName: s.hallName,
    startsAt: s.startsAt ? s.startsAt.toISOString() : '',
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
