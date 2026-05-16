import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PublicCacheService } from './cache/public-cache.service';
import { PublicContentService } from './public-content.service';
import { PublicContextService, type PublicContext } from './public-context.service';
import { PublicSearchService } from '../search/public-search.service';
import { makeEnvelope, type PublicEnvelope, type PublicSiteConfig } from './public-response.types';
import { PrismaService } from '../prisma/prisma.service';

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

@Public()
@Controller('public')
export class PublicController {
  constructor(
    private readonly ctx: PublicContextService,
    private readonly content: PublicContentService,
    private readonly cache: PublicCacheService,
    private readonly publicSearch: PublicSearchService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Site Config ───────────────────────────────────────────────────────────

  @Get('site-config')
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

    const supportedLocalesRows = await this.prisma.locale.findMany({
      where: { tenantId: context.tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      select: { code: true, name: true, nativeName: true, rtl: true },
    });

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
            ? { id: mall.logoMedia.id, url: mall.logoMedia.publicUrl, mimeType: mall.logoMedia.mimeType ?? null, alt: mall.logoMedia.altText ?? null, caption: mall.logoMedia.caption ?? null, width: mall.logoMedia.width ?? null, height: mall.logoMedia.height ?? null, dominantColor: mall.logoMedia.dominantColor ?? null }
            : null,
          cover: mall.coverMedia
            ? { id: mall.coverMedia.id, url: mall.coverMedia.publicUrl, mimeType: mall.coverMedia.mimeType ?? null, alt: mall.coverMedia.altText ?? null, caption: mall.coverMedia.caption ?? null, width: mall.coverMedia.width ?? null, height: mall.coverMedia.height ?? null, dominantColor: mall.coverMedia.dominantColor ?? null }
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
      defaultLocale: context.defaultLocale?.code ?? null,
      activeLocale: context.locale?.code ?? context.defaultLocale?.code ?? null,
      rtl: context.locale?.rtl ?? false,
    };

    const result = envelop(siteConfig, context);
    await this.cache.set(cacheKey, result, TTL.siteConfig);
    return result;
  }

  // ── Home ──────────────────────────────────────────────────────────────────

  @Get('home')
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
    });
    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.home);
    return result;
  }

  // ── Sliders ───────────────────────────────────────────────────────────────

  @Get('sliders')
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
    });
    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  @Get('events')
  async getEvents(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('category') category: string | undefined,
    @Query('search') search: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const limit = parseLimit(limitStr, 20, 50);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:events:${category ?? ''}:${search ?? ''}:${limit}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.content.getEvents({
      tenantId: context.tenantId,
      mallId: context.mallId,
      category,
      search,
      limit,
      localeId: context.locale?.id,
    });
    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  @Get('events/:slug')
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
    });
    if (!data) throw new NotFoundException('Event not found');

    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.detail);
    return result;
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  @Get('campaigns')
  async getCampaigns(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('storeId') storeId: string | undefined,
    @Query('search') search: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const limit = parseLimit(limitStr, 20, 50);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:campaigns:${storeId ?? ''}:${search ?? ''}:${limit}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.content.getCampaigns({
      tenantId: context.tenantId,
      mallId: context.mallId,
      storeId,
      search,
      limit,
      localeId: context.locale?.id,
    });
    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  @Get('campaigns/:slug')
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
    });
    if (!data) throw new NotFoundException('Campaign not found');

    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.detail);
    return result;
  }

  // ── Stores ────────────────────────────────────────────────────────────────

  @Get('stores')
  async getStores(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('categoryId') categoryId: string | undefined,
    @Query('search') search: string | undefined,
    @Query('featuredOnly') featuredOnlyStr: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    if (!context.mallId) {
      throw new BadRequestException('x-mall-id header is required for the stores endpoint');
    }
    const limit = parseLimit(limitStr, 50, 100);
    const featuredOnly = featuredOnlyStr === 'true';
    const cacheKey =
      `public:${context.tenantId}:${context.mallId}:stores:${categoryId ?? ''}:${search ?? ''}:${featuredOnly}:${limit}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.content.getStores({
      tenantId: context.tenantId,
      mallId: context.mallId,
      categoryId,
      search,
      featuredOnly,
      limit,
      localeId: context.locale?.id,
    });
    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  @Get('stores/:slug')
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
    });
    if (!data) throw new NotFoundException('Store not found');

    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.detail);
    return result;
  }

  // ── Pages ─────────────────────────────────────────────────────────────────

  @Get('pages/:slug')
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

  // ── Search ────────────────────────────────────────────────────────────────

  // ── Popups ─────────────────────────────────────────────────────────────────

  @Get('popups')
  async getPopups(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('locale') locale: string | undefined,
    @Query('channel') channel: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:popups:${channel ?? 'all'}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.content.getPopups({
      tenantId: context.tenantId,
      mallId: context.mallId,
      channel,
      localeId: context.locale?.id,
    });
    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  // ── Location Services ──────────────────────────────────────────────────────

  @Get('services')
  async getLocationServices(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    if (!context.mallId) {
      throw new BadRequestException('x-mall-id header is required for /public/services');
    }
    const cacheKey =
      `public:${context.tenantId}:${context.mallId}:services` + lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.content.getLocationServices({
      tenantId: context.tenantId,
      mallId: context.mallId,
      localeId: context.locale?.id,
    });
    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.list);
    return result;
  }

  @Get('services/:id')
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
  async search(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('locale') locale: string | undefined,
    @Query('q') q: string | undefined,
    @Query('type') type: string | undefined,
    @Query('limit') limitStr: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const limit = parseLimit(limitStr, 12, 50);
    const qKey = (q ?? '').trim().slice(0, 120);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:search:${qKey}:${type ?? ''}:${limit}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const data = await this.publicSearch.search({
      tenantId: context.tenantId,
      mallId: context.mallId,
      q,
      type,
      limit,
      localeId: context.locale?.id ?? null,
      localeCode: context.locale?.code ?? context.defaultLocale?.code ?? null,
    });
    const result = envelop(data, context);
    await this.cache.set(cacheKey, result, TTL.search);
    return result;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLimit(str: string | undefined, defaultVal: number, max: number): number {
  if (!str) return defaultVal;
  const n = parseInt(str, 10);
  if (Number.isNaN(n) || n < 1) return defaultVal;
  return Math.min(n, max);
}
