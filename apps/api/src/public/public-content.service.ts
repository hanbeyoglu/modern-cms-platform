import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  PublicCampaign,
  PublicCinema,
  PublicEvent,
  PublicHomeResponse,
  PublicMovieSession,
  PublicPage,
  PublicSlider,
  PublicStore,
} from './public-response.types';

// ── Shared Prisma select shapes ──────────────────────────────────────────────

const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  originalName: true,
} as const;

const MEDIA_URL_ONLY = { id: true, publicUrl: true } as const;

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PublicContentService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Sliders ──────────────────────────────────────────────────────────────

  async getSliders(opts: {
    tenantId: string;
    mallId?: string;
    targetDevice?: string;
    limit?: number;
  }): Promise<PublicSlider[]> {
    const now = new Date();
    const rows = await this.prisma.slider.findMany({
      where: {
        tenantId: opts.tenantId,
        deletedAt: null,
        status: 'PUBLISHED',
        ...(opts.mallId !== undefined ? { mallId: opts.mallId } : {}),
        ...(opts.targetDevice
          ? { targetDevice: opts.targetDevice as Prisma.EnumSliderTargetDeviceFilter['equals'] }
          : {}),
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      include: {
        desktopMedia: { select: MEDIA_SELECT },
        mobileMedia: { select: MEDIA_SELECT },
        videoMedia: { select: MEDIA_URL_ONLY },
      },
      orderBy: { sortOrder: 'asc' },
      take: opts.limit ?? 10,
    });
    return rows.map(mapSlider);
  }

  // ── Events ───────────────────────────────────────────────────────────────

  async getEvents(opts: {
    tenantId: string;
    mallId?: string;
    category?: string;
    search?: string;
    limit?: number;
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
        // upcoming: end date is in the future or not set
        OR: [{ endAt: null }, { endAt: { gte: now } }],
        ...(opts.category ? { category: opts.category } : {}),
        ...(opts.search
          ? { title: { contains: opts.search, mode: 'insensitive' as const } }
          : {}),
      },
      include: { coverMedia: { select: MEDIA_SELECT } },
      orderBy: [{ sortOrder: 'asc' }, { startAt: 'asc' }],
      take: opts.limit ?? 20,
    });
    return rows.map(mapEvent);
  }

  async getEventBySlug(opts: {
    tenantId: string;
    mallId?: string;
    slug: string;
  }): Promise<PublicEvent | null> {
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
      },
      include: { coverMedia: { select: MEDIA_SELECT } },
    });
    return row ? mapEvent(row) : null;
  }

  // ── Campaigns ────────────────────────────────────────────────────────────

  async getCampaigns(opts: {
    tenantId: string;
    mallId?: string;
    storeId?: string;
    search?: string;
    limit?: number;
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
    return rows.map(mapCampaign);
  }

  async getCampaignBySlug(opts: {
    tenantId: string;
    mallId?: string;
    slug: string;
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
    return row ? mapCampaign(row) : null;
  }

  // ── Stores ───────────────────────────────────────────────────────────────

  async getStores(opts: {
    tenantId: string;
    mallId: string;
    categoryId?: string;
    search?: string;
    featuredOnly?: boolean;
    limit?: number;
  }): Promise<PublicStore[]> {
    const rows = await this.prisma.mallStore.findMany({
      where: {
        tenantId: opts.tenantId,
        mallId: opts.mallId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(opts.featuredOnly ? { isFeatured: true } : {}),
        globalStore: {
          is: {
            deletedAt: null,
            status: 'ACTIVE',
            ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
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
        localLogoMedia: { select: MEDIA_URL_ONLY },
        globalStore: {
          include: {
            logoMedia: { select: MEDIA_URL_ONLY },
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { globalStore: { name: 'asc' } }],
      take: opts.limit ?? 50,
    });
    return rows.map(mapStore);
  }

  async getStoreBySlug(opts: {
    tenantId: string;
    mallId: string;
    slug: string;
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
        localLogoMedia: { select: MEDIA_URL_ONLY },
        globalStore: {
          include: {
            logoMedia: { select: MEDIA_URL_ONLY },
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    return row ? mapStore(row) : null;
  }

  // ── Pages ────────────────────────────────────────────────────────────────

  async getPageBySlug(opts: {
    tenantId: string;
    mallId?: string;
    slug: string;
  }): Promise<PublicPage | null> {
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
      },
      include: {
        blocks: {
          where: { deletedAt: null, status: 'ACTIVE' },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, type: true, title: true, dataJson: true, sortOrder: true },
        },
      },
    });
    return row ? mapPage(row) : null;
  }

  // ── Cinema ───────────────────────────────────────────────────────────────

  async getCinemas(opts: { tenantId: string; mallId: string }): Promise<PublicCinema[]> {
    const rows = await this.prisma.cinema.findMany({
      where: {
        tenantId: opts.tenantId,
        mallId: opts.mallId,
        deletedAt: null,
        status: 'ACTIVE',
      },
      include: { logoMedia: { select: MEDIA_URL_ONLY } },
      orderBy: { name: 'asc' },
    });
    return rows.map(mapCinema);
  }

  // ── Movie Sessions ────────────────────────────────────────────────────────

  async getMovieSessions(opts: {
    tenantId: string;
    mallId: string;
    cinemaId?: string;
    movieId?: string;
    date?: string;
    limit?: number;
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
    return rows.map(mapMovieSession);
  }

  // ── Home aggregation ─────────────────────────────────────────────────────

  async getHome(opts: { tenantId: string; mallId?: string }): Promise<PublicHomeResponse> {
    const todayStr = new Date().toISOString().split('T')[0];

    const [sliders, upcomingEvents, activeCampaigns, featuredStores, todayMovieSessions] =
      await Promise.all([
        this.getSliders({ tenantId: opts.tenantId, mallId: opts.mallId, limit: 10 }),
        this.getEvents({ tenantId: opts.tenantId, mallId: opts.mallId, limit: 6 }),
        this.getCampaigns({ tenantId: opts.tenantId, mallId: opts.mallId, limit: 6 }),
        opts.mallId
          ? this.getStores({
              tenantId: opts.tenantId,
              mallId: opts.mallId,
              featuredOnly: true,
              limit: 12,
            })
          : Promise.resolve([]),
        opts.mallId
          ? this.getMovieSessions({
              tenantId: opts.tenantId,
              mallId: opts.mallId,
              date: todayStr,
              limit: 10,
            })
          : Promise.resolve([]),
      ]);

    return { sliders, upcomingEvents, activeCampaigns, featuredStores, todayMovieSessions };
  }
}

// ── Response Mappers ──────────────────────────────────────────────────────────
// These functions strip all admin-only fields (createdBy, updatedBy, deletedAt,
// providerConfigJson, etc.) and expose only public-safe content.

type MediaRow = { publicUrl: string; originalName?: string | null } | null;

function toMediaRef(m: MediaRow): { url: string; altText: string | null } | null {
  if (!m) return null;
  return { url: m.publicUrl, altText: m.originalName ?? null };
}

function toDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function mapSlider(s: {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  desktopMedia: MediaRow;
  mobileMedia: MediaRow;
  videoMedia: { publicUrl: string } | null;
  linkType: string;
  linkValue: string | null;
  buttonText: string | null;
  targetDevice: string;
  sortOrder: number;
  startAt: Date | null;
  endAt: Date | null;
}): PublicSlider {
  return {
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    description: s.description,
    desktopMedia: toMediaRef(s.desktopMedia),
    mobileMedia: toMediaRef(s.mobileMedia),
    videoMedia: s.videoMedia ? { url: s.videoMedia.publicUrl } : null,
    linkType: s.linkType,
    linkValue: s.linkValue,
    buttonText: s.buttonText,
    targetDevice: s.targetDevice,
    sortOrder: s.sortOrder,
    startAt: toDate(s.startAt),
    endAt: toDate(s.endAt),
  };
}

function mapEvent(e: {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  coverMedia: MediaRow;
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
    coverMedia: toMediaRef(e.coverMedia),
    startAt: toDate(e.startAt),
    endAt: toDate(e.endAt),
    location: e.location,
    category: e.category,
    buttonText: e.buttonText,
    linkUrl: e.linkUrl,
    sortOrder: e.sortOrder,
    publishedAt: toDate(e.publishedAt),
  };
}

function mapCampaign(c: {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  coverMedia: MediaRow;
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
    coverMedia: toMediaRef(c.coverMedia),
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
  };
}

function mapPage(p: {
  id: string;
  slug: string;
  title: string;
  type: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  publishedAt: Date | null;
  blocks: Array<{
    id: string;
    type: string;
    title: string | null;
    dataJson: Prisma.JsonValue;
    sortOrder: number;
  }>;
}): PublicPage {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    type: p.type,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    seoKeywords: p.seoKeywords,
    publishedAt: toDate(p.publishedAt),
    blocks: p.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      title: b.title,
      dataJson: b.dataJson,
      sortOrder: b.sortOrder,
    })),
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
  sortOrder: number;
  localLogoMedia: { publicUrl: string } | null;
  globalStore: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    websiteUrl: string | null;
    logoMedia: { publicUrl: string } | null;
    category: { id: string; name: string; slug: string } | null;
  };
}): PublicStore {
  const logo =
    r.localLogoMedia?.publicUrl
      ? { url: r.localLogoMedia.publicUrl }
      : r.globalStore.logoMedia?.publicUrl
        ? { url: r.globalStore.logoMedia.publicUrl }
        : null;

  return {
    id: r.id,
    mallId: r.mallId,
    name: r.localName ?? r.globalStore.name,
    description: r.localDescription ?? r.globalStore.description,
    floor: r.floor,
    storeNo: r.storeNo,
    phone: r.phone,
    email: r.email,
    workingHoursJson: r.workingHoursJson,
    locationJson: r.locationJson,
    isFeatured: r.isFeatured,
    sortOrder: r.sortOrder,
    logo,
    globalStore: {
      id: r.globalStore.id,
      name: r.globalStore.name,
      slug: r.globalStore.slug,
      websiteUrl: r.globalStore.websiteUrl,
    },
    category: r.globalStore.category ?? null,
  };
}

function mapCinema(c: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoMedia: { publicUrl: string } | null;
}): PublicCinema {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    logo: c.logoMedia?.publicUrl ? { url: c.logoMedia.publicUrl } : null,
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
