import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { PublicApiKeyGuard } from './guards/public-api-key.guard';
import { Public } from '../common/decorators/public.decorator';
import { PublicCacheService } from './cache/public-cache.service';
import { PublicContentService } from './public-content.service';
import { PublicContextService, type PublicContext } from './public-context.service';
import { PublicSearchService } from '../search/public-search.service';
import { MediaGuidelinesService } from '../media/media-guidelines.service';
import {
  makeEnvelope,
  buildPaginationMeta,
  makePaginatedEnvelope,
  type PublicEnvelope,
  type PublicMediaGuideline,
  type PublicPaginatedEnvelope,
  type PublicSiteConfig,
} from './public-response.types';
import { parsePagination, parseLimit } from './public-pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import { MallLocalesService } from '../mall-locales/mall-locales.service';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiChannelQuery,
  ApiLocaleQuery,
  ApiPaginationQuery,
  ApiPublicContext,
  ApiPublicOperation,
  ApiSlugParam,
  ApiUuidParam,
} from '../swagger/swagger.decorators';
import {
  PublicCampaignsPaginatedDto,
  PublicEventsPaginatedDto,
  PublicMediaGuidelinesEnvelopeDto,
  PublicPaginatedEnvelopeDto,
  PublicEnvelopeDto,
  PublicSearchEnvelopeDto,
  PublicSiteConfigEnvelopeDto,
  PublicStoresPaginatedDto,
} from '../swagger/dto/public-swagger.dto';

// Cache TTLs in seconds
const TTL = {
  siteConfig: 300,
  home: 120,
  list: 120,
  detail: 300,
  search: 45,
} as const;

// Locale segment helper — keeps cache keys concise and consistent
function lseg(code: string | undefined | null): string {
  return code ? `:l:${code}` : ':l:none';
}

function envelop<T>(data: T, ctx: PublicContext): PublicEnvelope<T> {
  return makeEnvelope(data, {
    tenantId: ctx.tenantId,
    mallId: ctx.mallId,
    locale: ctx.locale?.code ?? ctx.defaultLocale?.code ?? null,
  });
}

function envelopeContext(ctx: PublicContext) {
  return {
    tenantId: ctx.tenantId,
    mallId: ctx.mallId,
    locale: ctx.locale?.code ?? ctx.defaultLocale?.code ?? null,
  };
}

function paginatedEnvelop<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  ctx: PublicContext,
): PublicPaginatedEnvelope<T> {
  return makePaginatedEnvelope(items, buildPaginationMeta(page, limit, total), envelopeContext(ctx));
}

@Public()
@UseGuards(PublicApiKeyGuard)
@ApiTags(SWAGGER_TAGS.PUBLIC)
@ApiSecurity('apiKey')
@ApiPublicContext()
@Controller('public')
export class PublicController {
  constructor(
    private readonly ctx: PublicContextService,
    private readonly content: PublicContentService,
    private readonly cache: PublicCacheService,
    private readonly publicSearch: PublicSearchService,
    private readonly mediaGuidelines: MediaGuidelinesService,
    private readonly prisma: PrismaService,
    private readonly mallLocales: MallLocalesService,
  ) {}

  // ── Site Config ───────────────────────────────────────────────────────────

  @Get('site-config')
  @ApiPublicOperation({ summary: 'public.siteConfig.summary',
    description:
      'Returns tenant/mall identity, supported locales, RTL flag, and optional mall location details (address, coordinates, working hours). Used on app bootstrap.',
    related: [SWAGGER_TAGS.LOCALES, SWAGGER_TAGS.MALLS],
  })
  @ApiLocaleQuery()
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicSiteConfigEnvelopeDto })
  async getSiteConfig(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('locale') locale: string | undefined,
  ): Promise<PublicEnvelope<PublicSiteConfig>> {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:site-config` + lseg(context.locale?.code);

    const cached = await this.cache.get<PublicEnvelope<PublicSiteConfig>>(cacheKey);
    if (cached) return cached;

    const supportedLocalesRows = await this.mallLocales.getActiveLocalesForMall(
      context.tenantId,
      context.mallId,
    );

    let location: PublicSiteConfig['location'] = null;
    if (context.mallId) {
      const mall = await this.prisma.mall.findFirst({
        where: { id: context.mallId, deletedAt: null, isPublic: true },
        include: {
          logoMedia: { select: { id: true, publicUrl: true, mimeType: true, altText: true, caption: true, width: true, height: true, dominantColor: true } },
          coverMedia: { select: { id: true, publicUrl: true, mimeType: true, altText: true, caption: true, width: true, height: true, dominantColor: true } },
        },
      });
      if (mall) {
        const hasAddress = mall.addressLine1 || mall.city || mall.country;
        const hasCoords = mall.latitude != null && mall.longitude != null;
        location = {
          id: mall.id,
          type: mall.type,
          name: mall.name,
          displayName: mall.displayName,
          slug: mall.slug,
          websiteUrl: mall.websiteUrl,
          phone: mall.phone,
          supportEmail: mall.supportEmail,
          logo: mall.logoMedia
            ? { id: mall.logoMedia.id, url: mall.logoMedia.publicUrl, mimeType: mall.logoMedia.mimeType ?? null, alt: mall.logoMedia.altText ?? null, caption: mall.logoMedia.caption ?? null, width: mall.logoMedia.width ?? null, height: mall.logoMedia.height ?? null, widthOverride: null, heightOverride: null, dominantColor: mall.logoMedia.dominantColor ?? null }
            : null,
          cover: mall.coverMedia
            ? { id: mall.coverMedia.id, url: mall.coverMedia.publicUrl, mimeType: mall.coverMedia.mimeType ?? null, alt: mall.coverMedia.altText ?? null, caption: mall.coverMedia.caption ?? null, width: mall.coverMedia.width ?? null, height: mall.coverMedia.height ?? null, widthOverride: null, heightOverride: null, dominantColor: mall.coverMedia.dominantColor ?? null }
            : null,
          address: hasAddress
            ? {
                line1: mall.addressLine1,
                line2: mall.addressLine2,
                city: mall.city,
                district: mall.district,
                country: mall.country,
                postalCode: mall.postalCode,
              }
            : null,
          coordinates: hasCoords
            ? { latitude: mall.latitude as number, longitude: mall.longitude as number }
            : null,
          timezone: mall.timezone,
          workingHours: mall.workingHoursJson,
          socialLinks: mall.socialLinksJson,
        };
      }
    }

    const siteConfig: PublicSiteConfig = {
      tenantId: context.tenantId,
      tenantName: context.tenant.name,
      tenantSlug: context.tenant.slug,
      mallId: context.mallId ?? null,
      mallName: context.mall?.name ?? null,
      mallSlug: context.mall?.slug ?? null,
      location,
      supportedLocales: supportedLocalesRows.map((l) => ({
        code: l.code,
        name: l.nativeName,
        rtl: l.rtl,
      })),
      languages: supportedLocalesRows.map((l) => ({
        code: l.code,
        default: l.isDefault,
        rtl: l.rtl,
      })),
      defaultLocale: context.defaultLocale?.code ?? null,
      activeLocale: context.locale?.code ?? context.defaultLocale?.code ?? null,
      rtl: context.locale?.rtl ?? false,
    };

    const result = envelop(siteConfig, context);
    await this.cache.set(cacheKey, result, TTL.siteConfig);
    return result;
  }

  @Get('media-guidelines')
  @ApiPublicOperation({ summary: 'public.mediaGuidelines.summary',
    description:
      'Returns recommended dimensions, accepted MIME types, and helper text for each media usage preset (e.g. campaign cover, slider desktop).',
    related: [SWAGGER_TAGS.MEDIA],
  })
  @ApiLocaleQuery()
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicMediaGuidelinesEnvelopeDto })
  async getMediaGuidelines(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('locale') locale: string | undefined,
  ): Promise<PublicEnvelope<PublicMediaGuideline[]>> {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const cacheKey = `public:${context.tenantId}:media-guidelines`;

    const cached = await this.cache.get<PublicEnvelope<PublicMediaGuideline[]>>(cacheKey);
    if (cached) return cached;

    const rows = await this.mediaGuidelines.listMerged(context.tenantId);
    const data: PublicMediaGuideline[] = rows
      .filter((r) => r.active)
      .map((r) => ({
        usageKey: r.usageKey,
        label: r.label,
        recommendedWidth: r.recommendedWidth,
        recommendedHeight: r.recommendedHeight,
        acceptedMimeTypes: r.acceptedMimeTypes,
        helperText: r.helperText,
        aspectRatioLocked: r.aspectRatioLocked,
      }));

    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.siteConfig);
    return result;
  }

  // ── Home ──────────────────────────────────────────────────────────────────

  @Get('home')
  @ApiPublicOperation({ summary: 'public.home.summary',
    description:
      'Returns a curated bundle for the home screen: hero sliders, featured stores, upcoming events, active campaigns, and today\'s movie sessions.',
    related: [SWAGGER_TAGS.SLIDERS, SWAGGER_TAGS.STORES, SWAGGER_TAGS.EVENTS, SWAGGER_TAGS.CAMPAIGNS],
  })
  @ApiLocaleQuery()
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicEnvelopeDto })
  async getHome(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:home` + lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.content.getHome({
      tenantId: context.tenantId,
      mallId: context.mallId,
      localeId: context.locale?.id,
      localeCode: context.locale?.code,
      defaultLocaleCode: context.defaultLocale?.code,
      defaultLocaleId: context.defaultLocale?.id ?? null,
    });
    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.home);
    return result;
  }

  // ── Sliders ───────────────────────────────────────────────────────────────

  @Get('sliders')
  @ApiPublicOperation({ summary: 'public.sliders.summary',
    description:
      'Returns slider groups with items for hero/banner placements. Filter by placement, linked entity, channel, or target device.',
    related: [SWAGGER_TAGS.SLIDERS, SWAGGER_TAGS.MEDIA],
  })
  @ApiLocaleQuery()
  @ApiChannelQuery()
  @ApiQuery({ name: 'placement', required: false, description: 'Slider placement key (e.g. HOME_HERO).' })
  @ApiQuery({ name: 'entityId', required: false, description: 'Linked entity UUID to scope sliders.' })
  @ApiQuery({ name: 'targetDevice', required: false, description: 'Target device filter: ALL, DESKTOP, MOBILE.' })
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicEnvelopeDto })
  async getSliders(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('placement') placement: string | undefined,
    @Query('entityId') entityId: string | undefined,
    @Query('channel') channel: string | undefined,
    @Query('targetDevice') targetDevice: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:sliders:` +
      `${placement ?? 'all'}:${entityId ?? 'all'}:${channel ?? 'all'}:${targetDevice ?? 'all'}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.content.getSliders({
      tenantId: context.tenantId,
      mallId: context.mallId,
      placement,
      entityId,
      channel,
      targetDevice,
      localeId: context.locale?.id,
      defaultLocaleId: context.defaultLocale?.id ?? null,
    });
    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  @Get('events')
  @ApiPublicOperation({ summary: 'public.events.summary',
    description: 'Paginated list of published events. Filter by category slug or free-text search.',
    related: [SWAGGER_TAGS.EVENTS],
  })
  @ApiLocaleQuery()
  @ApiPaginationQuery(20, 50)
  @ApiQuery({ name: 'category', required: false, description: 'Event category slug filter.' })
  @ApiQuery({ name: 'search', required: false, description: 'Free-text search across title and description.' })
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicEventsPaginatedDto })
  async getEvents(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('category') category: string | undefined,
    @Query('search') search: string | undefined,
    @Query('page') pageStr: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const { page, limit } = parsePagination(pageStr, limitStr, 20, 50);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:events:${category ?? ''}:${search ?? ''}:${page}:${limit}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const { items, total } = await this.content.getEvents({
      tenantId: context.tenantId,
      mallId: context.mallId,
      category,
      search,
      page,
      limit,
      localeId: context.locale?.id,
      defaultLocaleId: context.defaultLocale?.id ?? null,
    });
    const result = paginatedEnvelop(items, total, page, limit, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  @Get('events/:slug')
  @ApiPublicOperation({ summary: 'public.event.getBySlug.summary',
    description: 'Returns full event detail including SEO metadata, cover media, and schedule.',
    related: [SWAGGER_TAGS.EVENTS],
  })
  @ApiLocaleQuery()
  @ApiSlugParam('slug', 'Event URL slug')
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicEnvelopeDto })
  async getEventBySlug(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Param('slug') slug: string,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:event:${slug}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.content.getEventBySlug({
      tenantId: context.tenantId,
      mallId: context.mallId,
      slug,
      localeId: context.locale?.id,
      defaultLocaleId: context.defaultLocale?.id ?? null,
    });
    if (!data) throw new NotFoundException('Event not found');

    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.detail);
    return result;
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  @Get('campaigns')
  @ApiPublicOperation({ summary: 'public.campaigns.summary',
    description: 'Paginated list of published campaigns. Optionally filter by store or search term.',
    related: [SWAGGER_TAGS.CAMPAIGNS, SWAGGER_TAGS.STORES],
  })
  @ApiLocaleQuery()
  @ApiPaginationQuery(20, 50)
  @ApiQuery({ name: 'storeId', required: false, description: 'Filter campaigns linked to a store UUID.' })
  @ApiQuery({ name: 'search', required: false, description: 'Free-text search across title and description.' })
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicCampaignsPaginatedDto })
  async getCampaigns(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('storeId') storeId: string | undefined,
    @Query('search') search: string | undefined,
    @Query('page') pageStr: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const { page, limit } = parsePagination(pageStr, limitStr, 20, 50);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:campaigns:${storeId ?? ''}:${search ?? ''}:${page}:${limit}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const { items, total } = await this.content.getCampaigns({
      tenantId: context.tenantId,
      mallId: context.mallId,
      storeId,
      search,
      page,
      limit,
      localeId: context.locale?.id,
      defaultLocaleId: context.defaultLocale?.id ?? null,
    });
    const result = paginatedEnvelop(items, total, page, limit, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  @Get('campaigns/:slug')
  @ApiPublicOperation({ summary: 'public.campaign.getBySlug.summary',
    description: 'Returns full campaign detail including terms, coupon code, linked store, and SEO metadata.',
    related: [SWAGGER_TAGS.CAMPAIGNS],
  })
  @ApiLocaleQuery()
  @ApiSlugParam('slug', 'Campaign URL slug')
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicEnvelopeDto })
  async getCampaignBySlug(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Param('slug') slug: string,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:campaign:${slug}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.content.getCampaignBySlug({
      tenantId: context.tenantId,
      mallId: context.mallId,
      slug,
      localeId: context.locale?.id,
      defaultLocaleId: context.defaultLocale?.id ?? null,
    });
    if (!data) throw new NotFoundException('Campaign not found');

    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.detail);
    return result;
  }

  // ── Stores ────────────────────────────────────────────────────────────────

  @Get('stores')
  @ApiPublicOperation({ summary: 'public.stores.summary',
    description: 'Paginated directory of stores assigned to the current mall. Supports category, search, and featured filters.',
    mallRequired: true,
    related: [SWAGGER_TAGS.STORES, SWAGGER_TAGS.STORE_CATEGORIES],
  })
  @ApiLocaleQuery()
  @ApiPaginationQuery(50, 100)
  @ApiQuery({ name: 'categoryId', required: false, description: 'Store category UUID filter.' })
  @ApiQuery({ name: 'search', required: false, description: 'Free-text search across name, tags, and description.' })
  @ApiQuery({ name: 'featuredOnly', required: false, description: 'Set to `true` to return only featured stores.', schema: { type: 'boolean' } })
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicStoresPaginatedDto })
  async getStores(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('categoryId') categoryId: string | undefined,
    @Query('search') search: string | undefined,
    @Query('featuredOnly') featuredOnlyStr: string | undefined,
    @Query('page') pageStr: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    if (!context.mallId) {
      throw new BadRequestException('x-mall-id header is required for the stores endpoint');
    }
    const { page, limit } = parsePagination(pageStr, limitStr, 50, 100);
    const featuredOnly = featuredOnlyStr === 'true';
    const cacheKey =
      `public:${context.tenantId}:${context.mallId}:stores:${categoryId ?? ''}:${search ?? ''}:${featuredOnly}:${page}:${limit}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const { items, total } = await this.content.getStores({
      tenantId: context.tenantId,
      mallId: context.mallId,
      categoryId,
      search,
      featuredOnly,
      page,
      limit,
      localeId: context.locale?.id,
      defaultLocaleId: context.defaultLocale?.id ?? null,
    });
    const result = paginatedEnvelop(items, total, page, limit, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  @Get('stores/:slug')
  @ApiPublicOperation({ summary: 'public.store.getBySlug.summary',
    description: 'Returns full store profile including logo, category, working hours, location map data, and SEO metadata.',
    mallRequired: true,
    related: [SWAGGER_TAGS.STORES],
  })
  @ApiLocaleQuery()
  @ApiSlugParam('slug', 'Store URL slug')
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicEnvelopeDto })
  async getStoreBySlug(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Param('slug') slug: string,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    if (!context.mallId) {
      throw new BadRequestException('x-mall-id header is required for the stores endpoint');
    }
    const cacheKey =
      `public:${context.tenantId}:${context.mallId}:store:${slug}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.content.getStoreBySlug({
      tenantId: context.tenantId,
      mallId: context.mallId,
      slug,
      localeId: context.locale?.id,
      defaultLocaleId: context.defaultLocale?.id ?? null,
    });
    if (!data) throw new NotFoundException('Store not found');

    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.detail);
    return result;
  }

  // ── Pages ─────────────────────────────────────────────────────────────────

  @Get('pages/:slug')
  @ApiPublicOperation({ summary: 'public.page.getBySlug.summary',
    description: 'Returns page content, blocks, attachments, and SEO metadata. Supports HTML, PDF, and document-list render modes.',
    related: [SWAGGER_TAGS.PAGES, SWAGGER_TAGS.PAGE_BLOCKS],
  })
  @ApiLocaleQuery()
  @ApiSlugParam('slug', 'Page URL slug')
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicEnvelopeDto })
  async getPageBySlug(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Param('slug') slug: string,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:page:${slug}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.content.getPageBySlug({
      tenantId: context.tenantId,
      mallId: context.mallId,
      slug,
      localeId: context.locale?.id,
      localeCode: context.locale?.code ?? context.defaultLocale?.code,
    });
    if (!data) throw new NotFoundException('Page not found');

    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.detail);
    return result;
  }

  // ── Cinema ────────────────────────────────────────────────────────────────

  @Get('cinema')
  @ApiPublicOperation({ summary: 'public.cinemas.summary',
    description: 'Returns cinema operators configured for the current mall.',
    mallRequired: true,
    related: [SWAGGER_TAGS.CINEMAS, SWAGGER_TAGS.MOVIE_SESSIONS],
  })
  @ApiLocaleQuery()
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicEnvelopeDto })
  async getCinemas(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    if (!context.mallId) {
      throw new BadRequestException('x-mall-id header is required for the cinema endpoint');
    }
    const cacheKey =
      `public:${context.tenantId}:${context.mallId}:cinema` + lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.content.getCinemas({
      tenantId: context.tenantId,
      mallId: context.mallId,
      localeId: context.locale?.id,
    });
    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  // ── Movie Sessions ────────────────────────────────────────────────────────

  @Get('movie-sessions')
  @ApiPublicOperation({ summary: 'public.movieSessions.summary',
    description: 'Returns scheduled movie sessions for the mall. Filter by date (YYYY-MM-DD), cinema, or movie.',
    mallRequired: true,
    related: [SWAGGER_TAGS.MOVIE_SESSIONS, SWAGGER_TAGS.MOVIES],
  })
  @ApiLocaleQuery()
  @ApiQuery({ name: 'date', required: false, description: 'Session date in YYYY-MM-DD format (defaults to today).' })
  @ApiQuery({ name: 'cinemaId', required: false, description: 'Filter by cinema UUID.' })
  @ApiQuery({ name: 'movieId', required: false, description: 'Filter by movie UUID.' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max sessions to return (default 50, max 200).', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } })
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicEnvelopeDto })
  async getMovieSessions(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('date') date: string | undefined,
    @Query('cinemaId') cinemaId: string | undefined,
    @Query('movieId') movieId: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    if (!context.mallId) {
      throw new BadRequestException('x-mall-id header is required for the movie-sessions endpoint');
    }
    const limit = parseLimit(limitStr, 50, 200);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId}:movie-sessions:${date ?? ''}:${cinemaId ?? ''}:${movieId ?? ''}:${limit}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.content.getMovieSessions({
      tenantId: context.tenantId,
      mallId: context.mallId,
      date,
      cinemaId,
      movieId,
      limit,
      localeId: context.locale?.id,
    });
    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  // ── Popups ─────────────────────────────────────────────────────────────────

  @Get('popups')
  @ApiPublicOperation({ summary: 'public.popups.summary',
    description: 'Returns modal/popup content filtered by delivery channel (WEB, MOBILE, KIOSK, DIGITAL_SIGNAGE).',
    related: [SWAGGER_TAGS.POPUPS],
  })
  @ApiLocaleQuery()
  @ApiChannelQuery()
  @ApiPaginationQuery(20, 50)
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicPaginatedEnvelopeDto })
  async getPopups(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('locale') locale: string | undefined,
    @Query('channel') channel: string | undefined,
    @Query('page') pageStr: string | undefined,
    @Query('limit') limitStr: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const { page, limit } = parsePagination(pageStr, limitStr, 20, 50);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:popups:${channel ?? 'all'}:${page}:${limit}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const { items, total } = await this.content.getPopups({
      tenantId: context.tenantId,
      mallId: context.mallId,
      channel,
      page,
      limit,
      localeId: context.locale?.id,
    });
    const result = paginatedEnvelop(items, total, page, limit, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  // ── Location Services ──────────────────────────────────────────────────────

  @Get('services')
  @ApiPublicOperation({ summary: 'public.services.summary',
    description: 'Paginated directory of location services (amenities, facilities) within the current mall.',
    mallRequired: true,
    related: [SWAGGER_TAGS.SERVICES],
  })
  @ApiLocaleQuery()
  @ApiPaginationQuery(50, 100)
  @ApiQuery({ name: 'search', required: false, description: 'Free-text search across name, tags, and description.' })
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicPaginatedEnvelopeDto })
  async getLocationServices(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('locale') locale: string | undefined,
    @Query('search') search: string | undefined,
    @Query('page') pageStr: string | undefined,
    @Query('limit') limitStr: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    if (!context.mallId) {
      throw new BadRequestException('x-mall-id header is required for /public/services');
    }
    const { page, limit } = parsePagination(pageStr, limitStr, 50, 100);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId}:services:${search ?? ''}:${page}:${limit}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const { items, total } = await this.content.getLocationServices({
      tenantId: context.tenantId,
      mallId: context.mallId,
      search,
      page,
      limit,
      localeId: context.locale?.id,
    });
    const result = paginatedEnvelop(items, total, page, limit, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  @Get('services/:id')
  @ApiPublicOperation({ summary: 'public.service.getById.summary',
    description: 'Returns full location service detail including icon, cover media, contact info, and coordinates.',
    related: [SWAGGER_TAGS.SERVICES],
  })
  @ApiLocaleQuery()
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicEnvelopeDto })
  async getServiceById(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('locale') locale: string | undefined,
    @Param('id') id: string,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:service:${id}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const service = await this.content.getLocationServiceById({
      tenantId: context.tenantId,
      id,
    });
    if (!service) throw new NotFoundException('Service not found');

    const result = envelop(service, context);
    await this.cache.set(cacheKey, result, TTL.detail);
    return result;
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  @Get('search')
  @ApiPublicOperation({ summary: 'public.search.summary',
    description:
      'Full-text search across pages, events, campaigns, stores, movies, and cinemas. Results are ranked and paginated.',
    related: [SWAGGER_TAGS.SEARCH],
  })
  @ApiLocaleQuery()
  @ApiPaginationQuery(12, 50)
  @ApiQuery({ name: 'q', required: false, description: 'Search query (max 120 characters).' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Restrict results to a content type.',
    schema: { type: 'string', enum: ['PAGE', 'EVENT', 'CAMPAIGN', 'MALL_STORE', 'MOVIE', 'CINEMA'] },
  })
  @ApiResponse({ status: 200, description: 'public.response.200', type: PublicSearchEnvelopeDto })
  async search(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('locale') locale: string | undefined,
    @Query('q') q: string | undefined,
    @Query('type') type: string | undefined,
    @Query('page') pageStr: string | undefined,
    @Query('limit') limitStr: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const { page, limit } = parsePagination(pageStr, limitStr, 12, 50);
    const qKey = (q ?? '').trim().slice(0, 120);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:search:${qKey}:${type ?? ''}:${page}:${limit}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const { results, total } = await this.publicSearch.search({
      tenantId: context.tenantId,
      mallId: context.mallId,
      q,
      type,
      page,
      limit,
      localeId: context.locale?.id ?? null,
      localeCode: context.locale?.code ?? context.defaultLocale?.code ?? null,
    });
    const result = {
      success: true as const,
      locale: envelopeContext(context).locale,
      tenant: {
        id: envelopeContext(context).tenantId,
        mallId: envelopeContext(context).mallId ?? null,
      },
      pagination: buildPaginationMeta(page, limit, total),
      data: { results },
    };
    await this.cache.set(cacheKey, result, TTL.search);
    return result;
  }
}
