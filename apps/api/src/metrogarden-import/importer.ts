import type { Request } from 'express';
import type { Prisma, User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { MediaService } from '../media/media.service';
import type { GlobalStoresService } from '../global-stores/global-stores.service';
import type { MallStoresService } from '../mall-stores/mall-stores.service';
import type { StoreCategoriesService } from '../store-categories/store-categories.service';
import type { CampaignsService } from '../campaigns/campaigns.service';
import type { EventsService } from '../events/events.service';
import type { MoviesService } from '../movies/movies.service';
import type { MovieSessionsService } from '../movie-sessions/movie-sessions.service';
import type { SlidersService } from '../sliders/sliders.service';
import {
  computeDemoShiftDays,
  estimatePublicVisibility,
  formatDateOnly,
  shiftDateOnly,
} from './date-shift';
import {
  SOURCE_SYSTEM,
  categoryDisplayName,
  isExpired,
  isoDateAt,
  mapFloorLabel,
  mapSocialLinks,
  parseWorkingHoursText,
  resolveAbsoluteUrl,
} from './helpers';
import { MediaUploader } from './media-uploader';
import { collectRebrandSamples, rebrandText } from './rebrand';
import type {
  CliOptions,
  ImportReport,
  MetrogardenExport,
  RowResult,
  SourceCampaign,
  SourceEvent,
  SourceMovie,
  SourceSlider,
  SourceStore,
} from './types';

type Services = {
  prisma: PrismaService;
  media: MediaService;
  globalStores: GlobalStoresService;
  mallStores: MallStoresService;
  storeCategories: StoreCategoriesService;
  campaigns: CampaignsService;
  events: EventsService;
  movies: MoviesService;
  movieSessions?: MovieSessionsService;
  sliders: SlidersService;
};

export class MetrogardenImporter {
  private readonly req: Request;
  private readonly dryRun: boolean;
  private readonly shiftDates: boolean;
  private readonly shiftDays: number;
  private targetMallName: string;
  private readonly mediaUploader: MediaUploader;
  private readonly storeIdBySource = new Map<string, string>();
  private readonly report: ImportReport;

  constructor(
    private readonly services: Services,
    private readonly user: User,
    private readonly options: CliOptions,
    private readonly data: MetrogardenExport,
  ) {
    this.dryRun = options.mode === 'dry-run';
    this.shiftDates = options.shiftDates === true;
    this.shiftDays = this.shiftDates ? computeDemoShiftDays() : 0;
    this.targetMallName = (options.targetMallName ?? '').trim();
    this.req = { tenantId: options.tenantId, mallId: options.mallId } as Request;
    this.mediaUploader = new MediaUploader(
      services.prisma,
      services.media,
      user,
      options.tenantId,
      options.mallId,
      this.dryRun,
      options.batchId,
    );
    this.report = {
      mode: options.mode,
      tenantId: options.tenantId,
      mallId: options.mallId,
      targetMallName: this.targetMallName,
      shiftDates: this.shiftDates,
      dateShiftDays: this.shiftDays,
      startedAt: new Date().toISOString(),
      counts: {
        stores: data.stores.length,
        campaigns: data.campaigns.length,
        events: data.events.length,
        movies: data.movies.length,
        sliders: data.sliders.length,
        uniqueMediaUrls: data.mediaIndex?.length ?? 0,
      },
      media: this.mediaUploader.stats,
      expiredAsDraft: [],
      unmatchedStoreRefs: [],
      unsupportedFields: [],
      textReplacements: [],
      publicVisibility: estimatePublicVisibility({
        campaigns: data.campaigns,
        events: data.events,
        movies: data.movies,
        sliders: data.sliders,
        shiftDates: this.shiftDates,
      }),
      rows: [],
      errors: [],
    };
  }

  private shift(date?: string): string | undefined {
    return shiftDateOnly(date, this.shiftDays);
  }

  private rebrandFields(
    entityType: string,
    sourceKey: string,
    fields: Record<string, string | undefined>,
  ): Record<string, string | undefined> {
    return collectRebrandSamples(
      entityType,
      sourceKey,
      fields,
      this.targetMallName,
      this.report.textReplacements,
    );
  }

  async run(): Promise<ImportReport> {
    await this.assertScope();
    this.mediaUploader.stats.uniqueUrls = this.data.mediaIndex?.length
      ?? new Set(
          [
            ...this.data.stores.flatMap((s) => [s.cover_image, ...(s.images ?? [])]),
            ...this.data.campaigns.flatMap((c) => [c.image, c.hero_image]),
            ...this.data.events.flatMap((e) => [e.image, e.hero_image, ...(e.gallery ?? [])]),
            ...this.data.movies.flatMap((m) => [m.poster, m.cover_image, ...(m.gallery ?? [])]),
            ...this.data.sliders.map((s) => s.image),
          ].filter(Boolean),
        ).size;

    // Categories first
    const categoryIds = new Map<string, string>();
    for (const store of this.data.stores) {
      if (!store.category) continue;
      if (categoryIds.has(store.category)) continue;
      const categoryId = await this.ensureCategory(store.category);
      if (categoryId) categoryIds.set(store.category, categoryId);
    }

    for (const store of this.data.stores) {
      await this.importStore(store, categoryIds.get(store.category ?? '') ?? null);
    }

    for (const campaign of this.data.campaigns) {
      await this.importCampaign(campaign);
    }

    for (const event of this.data.events) {
      await this.importEvent(event);
    }

    for (const movie of this.data.movies) {
      await this.importMovie(movie);
    }

    await this.importSliders(this.data.sliders);

    this.report.media = { ...this.mediaUploader.stats };
    for (const failure of this.mediaUploader.failures) {
      this.report.errors.push(`media:${failure.url} → ${failure.error}`);
    }
    this.report.finishedAt = new Date().toISOString();
    return this.report;
  }

  private async assertScope(): Promise<void> {
    const tenant = await this.services.prisma.tenant.findFirst({
      where: { id: this.options.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!tenant) throw new Error(`Tenant bulunamadı: ${this.options.tenantId}`);

    const mall = await this.services.prisma.mall.findFirst({
      where: { id: this.options.mallId, tenantId: this.options.tenantId, deletedAt: null },
      select: { id: true, name: true, displayName: true },
    });
    if (!mall) {
      throw new Error(
        `Mall bulunamadı veya tenant ile eşleşmiyor: mall=${this.options.mallId} tenant=${this.options.tenantId}`,
      );
    }
    // Never trust source JSON tenant/mall ids — scope is always CLI/API options.
    if (!this.targetMallName) {
      this.targetMallName = (mall.displayName ?? mall.name).trim() || 'Demo AVM';
      this.report.targetMallName = this.targetMallName;
    }
  }

  private pushRow(row: RowResult): void {
    this.report.rows.push(row);
    if (row.unsupportedFields?.length) {
      this.report.unsupportedFields.push({
        entityType: row.entityType,
        sourceKey: row.sourceKey,
        fields: row.unsupportedFields,
      });
    }
  }

  private async findMapping(entityType: string, sourceKey: string) {
    return this.services.prisma.contentImportMapping.findUnique({
      where: {
        tenantId_sourceSystem_entityType_sourceKey: {
          tenantId: this.options.tenantId,
          sourceSystem: SOURCE_SYSTEM,
          entityType,
          sourceKey,
        },
      },
    });
  }

  private async upsertMapping(
    entityType: string,
    sourceKey: string,
    entityId: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    if (this.dryRun) return;
    await this.services.prisma.contentImportMapping.upsert({
      where: {
        tenantId_sourceSystem_entityType_sourceKey: {
          tenantId: this.options.tenantId,
          sourceSystem: SOURCE_SYSTEM,
          entityType,
          sourceKey,
        },
      },
      create: {
        tenantId: this.options.tenantId,
        mallId: this.options.mallId,
        batchId: this.options.batchId ?? null,
        sourceSystem: SOURCE_SYSTEM,
        entityType,
        sourceKey,
        entityId,
        metaJson: {
          ...(meta ?? {}),
          demoImportBatchId: this.options.batchId,
          isDemo: true,
        } as Prisma.InputJsonValue,
      },
      update: {
        entityId,
        mallId: this.options.mallId,
        batchId: this.options.batchId ?? null,
        metaJson: {
          ...(meta ?? {}),
          demoImportBatchId: this.options.batchId,
          isDemo: true,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async ensureCategory(categorySlug: string): Promise<string | null> {
    const sourceKey = `category:${categorySlug}`;
    const existing = await this.findMapping('store_category', sourceKey);
    if (existing) {
      this.pushRow({
        entityType: 'store_category',
        sourceKey,
        status: this.dryRun ? 'skipped' : 'skipped',
        entityId: existing.entityId,
        message: 'mapping mevcut',
      });
      return existing.entityId;
    }

    const name = categoryDisplayName(categorySlug);
    const bySlug = await this.services.prisma.storeCategory.findFirst({
      where: { mallId: this.options.mallId, slug: categorySlug, deletedAt: null },
      select: { id: true },
    });
    if (bySlug) {
      await this.upsertMapping('store_category', sourceKey, bySlug.id);
      this.pushRow({
        entityType: 'store_category',
        sourceKey,
        status: 'skipped',
        entityId: bySlug.id,
        message: 'slug ile bulundu',
      });
      return bySlug.id;
    }

    if (this.dryRun) {
      this.pushRow({
        entityType: 'store_category',
        sourceKey,
        status: 'would-create',
        message: name,
      });
      return `dry-run-category:${categorySlug}`;
    }

    try {
      const created = await this.services.storeCategories.create(this.req, this.user, {
        name,
        slug: categorySlug,
        active: true,
      });
      await this.upsertMapping('store_category', sourceKey, created.id);
      this.pushRow({
        entityType: 'store_category',
        sourceKey,
        status: 'created',
        entityId: created.id,
      });
      return created.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.pushRow({ entityType: 'store_category', sourceKey, status: 'error', message });
      this.report.errors.push(`store_category:${sourceKey} → ${message}`);
      return null;
    }
  }

  private async importStore(
    store: SourceStore,
    categoryId: string | null,
  ): Promise<void> {
    const unsupported: string[] = [];
    if (store.images?.length) unsupported.push('images[] (CMS mağaza galerisi yok)');
    if (store.meta) unsupported.push('meta');

    const hours = parseWorkingHoursText(store.working_hours);
    if (hours.unsupported) unsupported.push('working_hours (serbest metin parse edilemedi)');
    const social = mapSocialLinks(store.social_links);
    unsupported.push(...social.unsupported);

    // Brand/store names stay as-is; only place branding in descriptions/SEO is rebranded.
    const text = this.rebrandFields('mall_store', store.id, {
      description: store.description,
      metaTitle: store.meta?.title,
      metaDescription: store.meta?.description,
    });
    const description = text.description;

    const coverId = await this.mediaUploader.resolve(
      store.cover_image,
      'STORE_LOGO',
      `${store.name} logo`,
    );
    if (store.cover_image && !coverId && !this.dryRun) {
      this.pushRow({
        entityType: 'mall_store',
        sourceKey: store.id,
        status: 'error',
        message: 'Kapak görseli yüklenemedi',
        unsupportedFields: unsupported,
      });
      return;
    }

    const mapping = await this.findMapping('mall_store', store.id);
    const floor = mapFloorLabel(store.floor);

    if (this.dryRun) {
      this.pushRow({
        entityType: 'mall_store',
        sourceKey: store.id,
        status: mapping ? 'would-update' : 'would-create',
        entityId: mapping?.entityId,
        unsupportedFields: unsupported,
        message: store.name,
      });
      this.storeIdBySource.set(store.id, mapping?.entityId ?? `dry-run-store:${store.id}`);
      if (store.slug) this.storeIdBySource.set(store.slug, this.storeIdBySource.get(store.id)!);
      return;
    }

    try {
      if (mapping) {
        const updated = await this.services.mallStores.update(this.req, this.user, mapping.entityId, {
          detailTitle: store.name,
          localDescription: description,
          localLogoMediaId: coverId,
          floor,
          phone: store.phone,
          categoryId,
          isFeatured: store.is_featured ?? false,
          status: store.is_active === false ? 'PASSIVE' : 'ACTIVE',
          workingHoursJson: hours.schedule,
          searchTags: store.category ? [store.category] : [],
        });
        await this.services.globalStores.update(updated.globalStoreId, {
          name: store.name,
          description,
          phone: store.phone,
          websiteUrl: store.website,
          logoMediaId: coverId,
          socialLinks: social.links,
          status: store.is_active === false ? 'PASSIVE' : 'ACTIVE',
        }, this.user);
        await this.upsertMapping('mall_store', store.id, updated.id, { slug: store.slug });
        this.storeIdBySource.set(store.id, updated.id);
        if (store.slug) this.storeIdBySource.set(store.slug, updated.id);
        this.pushRow({
          entityType: 'mall_store',
          sourceKey: store.id,
          status: 'updated',
          entityId: updated.id,
          unsupportedFields: unsupported,
        });
        return;
      }

      let globalId: string | undefined;
      if (store.slug) {
        const existingGlobal = await this.services.prisma.globalStore.findFirst({
          where: { slug: store.slug, deletedAt: null },
          select: { id: true },
        });
        globalId = existingGlobal?.id;
      }

      if (globalId) {
        await this.services.globalStores.update(
          globalId,
          {
            name: store.name,
            description,
            phone: store.phone,
            websiteUrl: store.website,
            logoMediaId: coverId,
            socialLinks: social.links,
            status: store.is_active === false ? 'PASSIVE' : 'ACTIVE',
          },
          this.user,
        );
      } else {
        const global = await this.services.globalStores.create(
          {
            name: store.name,
            slug: store.slug,
            description,
            phone: store.phone,
            websiteUrl: store.website,
            logoMediaId: coverId,
            socialLinks: social.links,
            status: store.is_active === false ? 'PASSIVE' : 'ACTIVE',
          },
          this.user,
        );
        globalId = global.id;
      }

      const existingMallStore = await this.services.prisma.mallStore.findFirst({
        where: {
          mallId: this.options.mallId,
          globalStoreId: globalId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existingMallStore) {
        const updated = await this.services.mallStores.update(this.req, this.user, existingMallStore.id, {
          detailTitle: store.name,
          localDescription: description,
          localLogoMediaId: coverId,
          floor,
          phone: store.phone,
          categoryId,
          isFeatured: store.is_featured ?? false,
          status: store.is_active === false ? 'PASSIVE' : 'ACTIVE',
          workingHoursJson: hours.schedule,
          searchTags: store.category ? [store.category] : [],
        });
        await this.upsertMapping('mall_store', store.id, updated.id, {
          slug: store.slug,
          globalStoreId: globalId,
        });
        await this.upsertMapping('global_store', store.id, globalId, { slug: store.slug });
        this.storeIdBySource.set(store.id, updated.id);
        if (store.slug) this.storeIdBySource.set(store.slug, updated.id);
        this.pushRow({
          entityType: 'mall_store',
          sourceKey: store.id,
          status: 'updated',
          entityId: updated.id,
          unsupportedFields: unsupported,
          message: 'mevcut mall/global eşleşmesi',
        });
        return;
      }

      const mallStore = await this.services.mallStores.assign(this.req, this.user, {
        globalStoreId: globalId,
        detailTitle: store.name,
        localDescription: description,
        localLogoMediaId: coverId,
        floor,
        phone: store.phone,
        categoryId: categoryId ?? undefined,
        isFeatured: store.is_featured ?? false,
        status: store.is_active === false ? 'PASSIVE' : 'ACTIVE',
        workingHoursJson: hours.schedule,
        searchTags: store.category ? [store.category] : [],
      });

      await this.upsertMapping('mall_store', store.id, mallStore.id, {
        slug: store.slug,
        globalStoreId: globalId,
      });
      await this.upsertMapping('global_store', store.id, globalId, { slug: store.slug });
      this.storeIdBySource.set(store.id, mallStore.id);
      if (store.slug) this.storeIdBySource.set(store.slug, mallStore.id);
      this.pushRow({
        entityType: 'mall_store',
        sourceKey: store.id,
        status: 'created',
        entityId: mallStore.id,
        unsupportedFields: unsupported,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.pushRow({
        entityType: 'mall_store',
        sourceKey: store.id,
        status: 'error',
        message,
        unsupportedFields: unsupported,
      });
      this.report.errors.push(`mall_store:${store.id} → ${message}`);
    }
  }

  private resolveStoreRef(ref?: { id?: string; slug?: string }): string | undefined {
    if (!ref) return undefined;
    if (ref.id && this.storeIdBySource.has(ref.id)) return this.storeIdBySource.get(ref.id);
    if (ref.slug && this.storeIdBySource.has(ref.slug)) return this.storeIdBySource.get(ref.slug);
    return undefined;
  }

  private async importCampaign(campaign: SourceCampaign): Promise<void> {
    const unsupported: string[] = [];
    if (campaign.category) unsupported.push('category (kampanya kategori alanı yok; dynamicFieldsJson)');
    if (campaign.meta) unsupported.push('meta');
    if (campaign.is_featured !== undefined) unsupported.push('is_featured');

    const startDate = this.shift(campaign.start_date);
    const endDate = this.shift(campaign.end_date);
    const expired = isExpired(endDate);
    const status = expired || campaign.is_active === false || campaign.status === 'expired'
      ? 'DRAFT'
      : 'PUBLISHED';
    if (expired || campaign.status === 'expired') {
      this.report.expiredAsDraft.push({
        entityType: 'campaign',
        sourceKey: campaign.id,
        endDate: endDate ?? campaign.end_date ?? '(yok)',
      });
    }

    const text = this.rebrandFields('campaign', campaign.id, {
      title: campaign.title,
      shortDescription: campaign.short_description,
      description: campaign.description,
      terms: campaign.terms,
      metaTitle: campaign.meta?.title,
      metaDescription: campaign.meta?.description,
    });

    const storeId = this.resolveStoreRef(campaign.store);
    if (campaign.store && !storeId) {
      this.report.unmatchedStoreRefs.push({
        entityType: 'campaign',
        sourceKey: campaign.id,
        storeRef: campaign.store.id ?? campaign.store.slug ?? '?',
      });
    }

    const coverId = await this.mediaUploader.resolve(
      campaign.hero_image ?? campaign.image,
      'CAMPAIGN_COVER',
      text.title ?? campaign.title,
    );
    const mobileId = campaign.image && campaign.image !== campaign.hero_image
      ? await this.mediaUploader.resolve(campaign.image, 'CAMPAIGN_COVER', text.title ?? campaign.title)
      : coverId;

    if ((campaign.hero_image || campaign.image) && !coverId && !this.dryRun) {
      this.pushRow({
        entityType: 'campaign',
        sourceKey: campaign.id,
        status: 'error',
        message: 'Kapak görseli yüklenemedi',
        unsupportedFields: unsupported,
      });
      return;
    }

    const mapping = await this.findMapping('campaign', campaign.id);
    const dto = {
      title: text.title ?? campaign.title,
      slug: campaign.slug,
      shortDescription: text.shortDescription,
      description: text.description,
      terms: text.terms,
      buttonText: campaign.discount_label,
      storeId: storeId && !storeId.startsWith('dry-run-') ? storeId : undefined,
      sharedCoverImageId: coverId && !coverId.startsWith('dry-run-') ? coverId : undefined,
      sharedMobileCoverImageId: mobileId && !mobileId.startsWith('dry-run-') ? mobileId : undefined,
      sameImageForAllLocales: true,
      campaignStartAt: startDate ? isoDateAt(startDate) : undefined,
      campaignEndAt: endDate ? isoDateAt(endDate, '23:59') : undefined,
      publishStartAt: startDate ? isoDateAt(startDate) : undefined,
      publishEndAt: endDate ? isoDateAt(endDate, '23:59') : undefined,
      status: status as 'DRAFT' | 'PUBLISHED',
      channels: ['WEB' as const],
      dynamicFieldsJson: {
        importSource: SOURCE_SYSTEM,
        importSourceKey: campaign.id,
        demoImportBatchId: this.options.batchId,
        isDemo: true,
        datesShifted: this.shiftDates,
        sourceCategory: campaign.category,
        sourceStatus: campaign.status,
        sourceIsFeatured: campaign.is_featured,
      },
    };

    if (this.dryRun) {
      this.pushRow({
        entityType: 'campaign',
        sourceKey: campaign.id,
        status: mapping ? 'would-update' : 'would-create',
        entityId: mapping?.entityId,
        unsupportedFields: unsupported,
        message: `${text.title ?? campaign.title} → ${status}`,
      });
      return;
    }

    try {
      if (mapping) {
        const updated = await this.services.campaigns.update(
          mapping.entityId,
          dto,
          this.user,
          this.options.tenantId,
          this.options.mallId,
        );
        await this.upsertMapping('campaign', campaign.id, updated.id);
        this.pushRow({
          entityType: 'campaign',
          sourceKey: campaign.id,
          status: 'updated',
          entityId: updated.id,
          unsupportedFields: unsupported,
          message: status,
        });
      } else {
        const created = await this.services.campaigns.create(
          dto,
          this.user,
          this.options.tenantId,
          this.options.mallId,
        );
        await this.upsertMapping('campaign', campaign.id, created.id);
        this.pushRow({
          entityType: 'campaign',
          sourceKey: campaign.id,
          status: 'created',
          entityId: created.id,
          unsupportedFields: unsupported,
          message: status,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.pushRow({
        entityType: 'campaign',
        sourceKey: campaign.id,
        status: 'error',
        message,
        unsupportedFields: unsupported,
      });
      this.report.errors.push(`campaign:${campaign.id} → ${message}`);
    }
  }

  private async importEvent(event: SourceEvent): Promise<void> {
    const unsupported: string[] = [];
    if (event.gallery?.length) unsupported.push('gallery[] (CMS event galeri alanı yok)');
    if (event.organizer) unsupported.push('organizer → dynamicFieldsJson');
    if (event.ticket_price) unsupported.push('ticket_price → dynamicFieldsJson');
    if (event.tags?.length) unsupported.push('tags → dynamicFieldsJson');
    if (event.is_featured !== undefined) unsupported.push('is_featured');

    const startDate = this.shift(event.date);
    const endDate = this.shift(event.end_date ?? event.date);
    const expired = isExpired(endDate);
    const status = expired ? 'DRAFT' : 'PUBLISHED';
    if (expired) {
      this.report.expiredAsDraft.push({
        entityType: 'event',
        sourceKey: event.id,
        endDate: endDate ?? '(yok)',
      });
    }

    const text = this.rebrandFields('event', event.id, {
      title: event.title,
      shortDescription: event.short_description,
      description: event.description,
      location: event.location,
      organizer: event.organizer,
    });

    const coverId = await this.mediaUploader.resolve(
      event.hero_image ?? event.image,
      'EVENT_COVER',
      text.title ?? event.title,
    );
    if ((event.hero_image || event.image) && !coverId && !this.dryRun) {
      this.pushRow({
        entityType: 'event',
        sourceKey: event.id,
        status: 'error',
        message: 'Kapak görseli yüklenemedi',
        unsupportedFields: unsupported,
      });
      return;
    }

    // Upload gallery images into media library for reuse, but do not invent entity fields.
    if (event.gallery?.length && !this.dryRun) {
      for (const [index, url] of event.gallery.entries()) {
        const mediaId = await this.mediaUploader.resolve(
          url,
          'EVENT_COVER',
          `${text.title ?? event.title} gallery ${index + 1}`,
        );
        if (!mediaId) {
          this.report.errors.push(`event:${event.id} gallery[${index}] yüklenemedi`);
        }
      }
    } else if (event.gallery?.length && this.dryRun) {
      for (const url of event.gallery) {
        await this.mediaUploader.resolve(url, 'EVENT_COVER', text.title ?? event.title);
      }
    }

    const mapping = await this.findMapping('event', event.id);
    const dto = {
      title: text.title ?? event.title,
      slug: event.slug,
      shortDescription: text.shortDescription,
      description: text.description,
      location: text.location,
      category: event.category,
      isFree: event.is_free ?? true,
      sharedCoverImageId: coverId && !coverId.startsWith('dry-run-') ? coverId : undefined,
      sameImageForAllLocales: true,
      eventStartAt: startDate ? isoDateAt(startDate, event.time ?? '00:00') : undefined,
      eventEndAt: endDate
        ? isoDateAt(endDate, event.end_time ?? event.time ?? '23:59')
        : undefined,
      publishStartAt: startDate ? isoDateAt(startDate, event.time ?? '00:00') : undefined,
      publishEndAt: endDate ? isoDateAt(endDate, event.end_time ?? '23:59') : undefined,
      status: status as 'DRAFT' | 'PUBLISHED',
      channels: ['WEB' as const],
      dynamicFieldsJson: {
        importSource: SOURCE_SYSTEM,
        importSourceKey: event.id,
        demoImportBatchId: this.options.batchId,
        isDemo: true,
        datesShifted: this.shiftDates,
        organizer: text.organizer ?? event.organizer,
        ticketPrice: event.ticket_price,
        tags: event.tags,
        sourceIsFeatured: event.is_featured,
      },
    };

    if (this.dryRun) {
      this.pushRow({
        entityType: 'event',
        sourceKey: event.id,
        status: mapping ? 'would-update' : 'would-create',
        entityId: mapping?.entityId,
        unsupportedFields: unsupported,
        message: `${text.title ?? event.title} → ${status}`,
      });
      return;
    }

    try {
      if (mapping) {
        const updated = await this.services.events.update(
          mapping.entityId,
          dto,
          this.user,
          this.options.tenantId,
          this.options.mallId,
        );
        await this.upsertMapping('event', event.id, updated.id);
        this.pushRow({
          entityType: 'event',
          sourceKey: event.id,
          status: 'updated',
          entityId: updated.id,
          unsupportedFields: unsupported,
          message: status,
        });
      } else {
        const created = await this.services.events.create(
          dto,
          this.user,
          this.options.tenantId,
          this.options.mallId,
        );
        await this.upsertMapping('event', event.id, created.id);
        this.pushRow({
          entityType: 'event',
          sourceKey: event.id,
          status: 'created',
          entityId: created.id,
          unsupportedFields: unsupported,
          message: status,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.pushRow({
        entityType: 'event',
        sourceKey: event.id,
        status: 'error',
        message,
        unsupportedFields: unsupported,
      });
      this.report.errors.push(`event:${event.id} → ${message}`);
    }
  }

  private async importMovie(movie: SourceMovie): Promise<void> {
    const unsupported: string[] = [];
    if (movie.cover_image) unsupported.push('cover_image (CMS yalnızca posterMediaId)');
    if (movie.gallery?.length) unsupported.push('gallery[]');
    if (movie.director) unsupported.push('director (CreateMovieDto cast/directors yok)');
    if (movie.cast?.length) unsupported.push('cast');
    if (movie.language) unsupported.push('language');
    if (movie.subtitle) unsupported.push('subtitle');
    if (movie.is_featured !== undefined) unsupported.push('is_featured');

    const text = this.rebrandFields('movie', movie.id, {
      title: movie.title,
      synopsis: movie.synopsis,
    });

    const posterId = await this.mediaUploader.resolve(
      movie.poster,
      'MOVIE_POSTER',
      text.title ?? movie.title,
    );
    if (movie.cover_image && movie.cover_image !== movie.poster) {
      await this.mediaUploader.resolve(
        movie.cover_image,
        'MOVIE_POSTER',
        `${text.title ?? movie.title} cover`,
      );
    }
    if (movie.gallery?.length) {
      for (const [index, url] of movie.gallery.entries()) {
        await this.mediaUploader.resolve(
          url,
          'MOVIE_POSTER',
          `${text.title ?? movie.title} gallery ${index + 1}`,
        );
      }
    }

    if (movie.poster && !posterId && !this.dryRun) {
      this.pushRow({
        entityType: 'movie',
        sourceKey: movie.id,
        status: 'error',
        message: 'Poster yüklenemedi',
        unsupportedFields: unsupported,
      });
      return;
    }

    const ticketUrl = resolveAbsoluteUrl(movie.ticket_url, this.options.siteBaseUrl);
    if (movie.ticket_url && !ticketUrl) unsupported.push('ticket_url (geçersiz/#)');

    const listingStatus =
      movie.status === 'coming-soon' || movie.is_current === false ? 'UPCOMING' : 'NOW_PLAYING';
    const releaseDate = this.shift(movie.release_date);
    const today = formatDateOnly(new Date());
    // When dates are shifted, keep NOW_PLAYING films publicly listable around import day.
    const publishStartAt = this.shiftDates
      ? isoDateAt(today)
      : releaseDate
        ? isoDateAt(releaseDate)
        : undefined;

    const mapping = await this.findMapping('movie', movie.id);
    const dto = {
      title: text.title ?? movie.title,
      slug: movie.slug,
      description: text.synopsis,
      posterMediaId: posterId && !posterId.startsWith('dry-run-') ? posterId : undefined,
      durationMinutes: movie.duration,
      genre: movie.genre?.join(', '),
      rating: movie.rating,
      ticketUrl,
      releaseDate: releaseDate ? isoDateAt(releaseDate) : undefined,
      publishStartAt,
      status: 'ACTIVE' as const,
      listingStatus: listingStatus as 'NOW_PLAYING' | 'UPCOMING',
    };

    const sessionTimes =
      this.shiftDates && listingStatus === 'NOW_PLAYING' ? movie.daily_times ?? [] : [];
    if (movie.daily_times?.length && !this.shiftDates) {
      unsupported.push('daily_times (tarih kaydırma kapalı; seans oluşturulmadı)');
    }

    if (this.dryRun) {
      this.pushRow({
        entityType: 'movie',
        sourceKey: movie.id,
        status: mapping ? 'would-update' : 'would-create',
        entityId: mapping?.entityId,
        unsupportedFields: unsupported,
        message: `${dto.title} → ${listingStatus}${sessionTimes.length ? ` +${sessionTimes.length} seans` : ''}`,
      });
      for (const showTime of sessionTimes) {
        const sourceKey = `${movie.id}:${today}:${showTime}`;
        const existingSession = await this.findMapping('movie_session', sourceKey);
        this.pushRow({
          entityType: 'movie_session',
          sourceKey,
          status: existingSession ? 'would-update' : 'would-create',
          entityId: existingSession?.entityId,
          message: `${dto.title} ${today} ${showTime}`,
        });
      }
      return;
    }

    try {
      let movieId: string;
      if (mapping) {
        const updated = await this.services.movies.update(
          mapping.entityId,
          dto,
          this.user,
          this.options.tenantId,
        );
        movieId = updated.id;
        await this.upsertMapping('movie', movie.id, movieId);
        this.pushRow({
          entityType: 'movie',
          sourceKey: movie.id,
          status: 'updated',
          entityId: movieId,
          unsupportedFields: unsupported,
        });
      } else {
        const created = await this.services.movies.create(dto, this.user, this.options.tenantId);
        movieId = created.id;
        await this.upsertMapping('movie', movie.id, movieId);
        this.pushRow({
          entityType: 'movie',
          sourceKey: movie.id,
          status: 'created',
          entityId: movieId,
          unsupportedFields: unsupported,
        });
      }

      if (sessionTimes.length && this.services.movieSessions) {
        await this.upsertDemoSessions(movie.id, movieId, sessionTimes, today);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.pushRow({
        entityType: 'movie',
        sourceKey: movie.id,
        status: 'error',
        message,
        unsupportedFields: unsupported,
      });
      this.report.errors.push(`movie:${movie.id} → ${message}`);
    }
  }

  private async upsertDemoSessions(
    sourceMovieKey: string,
    movieId: string,
    times: string[],
    showDate: string,
  ): Promise<void> {
    if (!this.services.movieSessions) return;
    for (const showTime of times) {
      const sourceKey = `${sourceMovieKey}:${showDate}:${showTime}`;
      const existing = await this.findMapping('movie_session', sourceKey);
      if (existing) {
        this.pushRow({
          entityType: 'movie_session',
          sourceKey,
          status: 'skipped',
          entityId: existing.entityId,
          message: 'mevcut demo seans',
        });
        continue;
      }
      try {
        const created = await this.services.movieSessions.createForMovie(
          movieId,
          {
            showDate,
            showTime,
            hallName: 'Salon 1',
            cinemaName: `${this.targetMallName} Sinema`,
          },
          this.user,
          this.options.tenantId,
          this.options.mallId,
        );
        await this.upsertMapping('movie_session', sourceKey, created.id, {
          movieId,
          showDate,
          showTime,
          demoImportBatchId: this.options.batchId,
          isDemo: true,
        });
        this.pushRow({
          entityType: 'movie_session',
          sourceKey,
          status: 'created',
          entityId: created.id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.pushRow({
          entityType: 'movie_session',
          sourceKey,
          status: 'error',
          message,
        });
        this.report.errors.push(`movie_session:${sourceKey} → ${message}`);
      }
    }
  }

  private async importSliders(sliders: SourceSlider[]): Promise<void> {
    if (!sliders.length) return;
    const groupKey = 'slider-group:home';
    const groupMapping = await this.findMapping('slider', groupKey);
    const sliderTitle =
      rebrandText('Metrogarden Home', this.targetMallName) ?? `${this.targetMallName} Home`;

    if (this.dryRun) {
      this.rebrandFields('slider', groupKey, { title: 'Metrogarden Home' });
      this.pushRow({
        entityType: 'slider',
        sourceKey: groupKey,
        status: groupMapping ? 'would-update' : 'would-create',
        entityId: groupMapping?.entityId,
        message: sliderTitle,
      });
      for (const slide of sliders) {
        const text = this.rebrandFields('slider_item', slide.id, {
          title: slide.title,
          subtitle: slide.subtitle,
          eyebrow: slide.eyebrow,
          ctaLabel: slide.cta_label,
        });
        await this.mediaUploader.resolve(slide.image, 'SLIDER_DESKTOP', text.title ?? slide.title);
        const itemMapping = await this.findMapping('slider_item', slide.id);
        const unsupported: string[] = [];
        if (slide.eyebrow) unsupported.push('eyebrow');
        this.pushRow({
          entityType: 'slider_item',
          sourceKey: slide.id,
          status: itemMapping ? 'would-update' : 'would-create',
          entityId: itemMapping?.entityId,
          unsupportedFields: unsupported,
          message: text.title ?? slide.title,
        });
      }
      return;
    }

    let sliderId = groupMapping?.entityId;
    try {
      if (sliderId) {
        await this.services.sliders.update(
          sliderId,
          {
            title: sliderTitle,
            placementType: 'HOME',
            status: 'PUBLISHED',
            channels: ['WEB'],
            sortOrder: 0,
          },
          this.user,
          this.options.tenantId,
        );
        this.pushRow({
          entityType: 'slider',
          sourceKey: groupKey,
          status: 'updated',
          entityId: sliderId,
        });
      } else {
        const created = await this.services.sliders.create(
          {
            title: sliderTitle,
            placementType: 'HOME',
            status: 'PUBLISHED',
            channels: ['WEB'],
            sortOrder: 0,
          },
          this.user,
          this.options.tenantId,
          this.options.mallId,
        );
        sliderId = created.id;
        await this.upsertMapping('slider', groupKey, sliderId);
        this.pushRow({
          entityType: 'slider',
          sourceKey: groupKey,
          status: 'created',
          entityId: sliderId,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.pushRow({ entityType: 'slider', sourceKey: groupKey, status: 'error', message });
      this.report.errors.push(`slider:${groupKey} → ${message}`);
      return;
    }

    for (const slide of sliders) {
      const unsupported: string[] = [];
      if (slide.eyebrow) unsupported.push('eyebrow → description öneki');
      const text = this.rebrandFields('slider_item', slide.id, {
        title: slide.title,
        subtitle: slide.subtitle,
        eyebrow: slide.eyebrow,
        ctaLabel: slide.cta_label,
      });
      const imageId = await this.mediaUploader.resolve(
        slide.image,
        'SLIDER_DESKTOP',
        text.title ?? slide.title,
      );
      if (slide.image && !imageId) {
        this.pushRow({
          entityType: 'slider_item',
          sourceKey: slide.id,
          status: 'error',
          message: 'Görsel yüklenemedi',
          unsupportedFields: unsupported,
        });
        continue;
      }

      const linkUrl = resolveAbsoluteUrl(slide.cta_url, this.options.siteBaseUrl);
      if (slide.cta_url && !linkUrl) unsupported.push('cta_url');

      const description =
        [text.eyebrow, text.subtitle].filter(Boolean).join(' — ') || text.subtitle;
      const itemMapping = await this.findMapping('slider_item', slide.id);
      const itemDto = {
        title: text.title ?? slide.title,
        description,
        buttonText: text.ctaLabel ?? slide.cta_label,
        linkUrl,
        sharedImageId: imageId,
        sameImageForAllLocales: true,
        sortOrder: slide.order ?? 0,
        status: slide.is_active === false ? ('DRAFT' as const) : ('PUBLISHED' as const),
      };

      try {
        if (itemMapping) {
          const updated = await this.services.sliders.updateItem(
            sliderId!,
            itemMapping.entityId,
            itemDto,
            this.user,
            this.options.tenantId,
          );
          await this.upsertMapping('slider_item', slide.id, updated.id, { sliderId });
          this.pushRow({
            entityType: 'slider_item',
            sourceKey: slide.id,
            status: 'updated',
            entityId: updated.id,
            unsupportedFields: unsupported,
          });
        } else {
          const created = await this.services.sliders.createItem(
            sliderId!,
            itemDto,
            this.user,
            this.options.tenantId,
          );
          await this.upsertMapping('slider_item', slide.id, created.id, { sliderId });
          this.pushRow({
            entityType: 'slider_item',
            sourceKey: slide.id,
            status: 'created',
            entityId: created.id,
            unsupportedFields: unsupported,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.pushRow({
          entityType: 'slider_item',
          sourceKey: slide.id,
          status: 'error',
          message,
          unsupportedFields: unsupported,
        });
        this.report.errors.push(`slider_item:${slide.id} → ${message}`);
      }
    }
  }
}
