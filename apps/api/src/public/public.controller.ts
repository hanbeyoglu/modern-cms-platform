import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { PublicCacheService } from './cache/public-cache.service';
import { PublicContentService } from './public-content.service';
import { PublicContextService } from './public-context.service';
import type { PublicSiteConfig } from './public-response.types';

// Cache TTLs in seconds
const TTL = {
  siteConfig: 300,
  home: 120,
  list: 120,
  detail: 300,
} as const;

// Locale segment helper — keeps cache keys concise and consistent
function lseg(code: string | undefined | null): string {
  return code ? `:l:${code}` : ':l:none';
}

@Controller('public')
export class PublicController {
  constructor(
    private readonly ctx: PublicContextService,
    private readonly content: PublicContentService,
    private readonly cache: PublicCacheService,
  ) {}

  // ── Site Config ───────────────────────────────────────────────────────────
  // Site config is locale-independent; no locale param here.

  @Get('site-config')
  async getSiteConfig(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
  ): Promise<PublicSiteConfig> {
    const context = await this.ctx.resolve(tenantId, mallId);
    const cacheKey = `public:${context.tenantId}:${context.mallId ?? 'none'}:site-config`;

    const cached = await this.cache.get<PublicSiteConfig>(cacheKey);
    if (cached) return cached;

    const result: PublicSiteConfig = {
      tenantId: context.tenantId,
      tenantName: context.tenant.name,
      tenantSlug: context.tenant.slug,
      mallId: context.mallId ?? null,
      mallName: context.mall?.name ?? null,
      mallSlug: context.mall?.slug ?? null,
    };

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

    const result = await this.content.getHome({
      tenantId: context.tenantId,
      mallId: context.mallId,
      localeId: context.locale?.id,
      localeCode: context.locale?.code,
      defaultLocaleCode: context.defaultLocale?.code,
    });
    await this.cache.set(cacheKey, result, TTL.home);
    return result;
  }

  // ── Sliders ───────────────────────────────────────────────────────────────

  @Get('sliders')
  async getSliders(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-mall-id') mallId: string | undefined,
    @Query('targetDevice') targetDevice: string | undefined,
    @Query('locale') locale: string | undefined,
  ) {
    const context = await this.ctx.resolve(tenantId, mallId, locale);
    const cacheKey =
      `public:${context.tenantId}:${context.mallId ?? 'none'}:sliders:${targetDevice ?? 'all'}` +
      lseg(context.locale?.code);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.content.getSliders({
      tenantId: context.tenantId,
      mallId: context.mallId,
      targetDevice,
      localeId: context.locale?.id,
    });
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

    const result = await this.content.getEvents({
      tenantId: context.tenantId,
      mallId: context.mallId,
      category,
      search,
      limit,
      localeId: context.locale?.id,
    });
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

    const result = await this.content.getEventBySlug({
      tenantId: context.tenantId,
      mallId: context.mallId,
      slug,
      localeId: context.locale?.id,
    });
    if (!result) throw new NotFoundException('Event not found');

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

    const result = await this.content.getCampaigns({
      tenantId: context.tenantId,
      mallId: context.mallId,
      storeId,
      search,
      limit,
      localeId: context.locale?.id,
    });
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

    const result = await this.content.getCampaignBySlug({
      tenantId: context.tenantId,
      mallId: context.mallId,
      slug,
      localeId: context.locale?.id,
    });
    if (!result) throw new NotFoundException('Campaign not found');

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

    const result = await this.content.getStores({
      tenantId: context.tenantId,
      mallId: context.mallId,
      categoryId,
      search,
      featuredOnly,
      limit,
      localeId: context.locale?.id,
    });
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

    const result = await this.content.getStoreBySlug({
      tenantId: context.tenantId,
      mallId: context.mallId,
      slug,
      localeId: context.locale?.id,
    });
    if (!result) throw new NotFoundException('Store not found');

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

    const result = await this.content.getPageBySlug({
      tenantId: context.tenantId,
      mallId: context.mallId,
      slug,
      localeId: context.locale?.id,
    });
    if (!result) throw new NotFoundException('Page not found');

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

    const result = await this.content.getCinemas({
      tenantId: context.tenantId,
      mallId: context.mallId,
      localeId: context.locale?.id,
    });
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

    const result = await this.content.getMovieSessions({
      tenantId: context.tenantId,
      mallId: context.mallId,
      date,
      cinemaId,
      movieId,
      limit,
      localeId: context.locale?.id,
    });
    await this.cache.set(cacheKey, result, TTL.list);
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
