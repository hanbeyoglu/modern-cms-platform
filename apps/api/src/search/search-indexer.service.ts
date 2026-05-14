import { Injectable, Logger } from '@nestjs/common';
import type { LocalizedEntityType, SearchIndexEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SearchNormalizerService } from './search-normalizer.service';

function jsonSnippet(data: unknown, max = 1500): string {
  try {
    const s = JSON.stringify(data ?? {});
    return s.length > max ? s.slice(0, max) : s;
  } catch {
    return '';
  }
}

@Injectable()
export class SearchIndexerService {
  private readonly log = new Logger(SearchIndexerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: SearchNormalizerService,
  ) {}

  async remove(entityType: SearchIndexEntityType, entityId: string): Promise<void> {
    await this.prisma.searchIndexEntry.deleteMany({ where: { entityType, entityId } });
  }

  private async translationBlob(
    tenantId: string,
    localizedType: LocalizedEntityType,
    entityId: string,
  ): Promise<string> {
    const rows = await this.prisma.localizedContent.findMany({
      where: { tenantId, entityType: localizedType, entityId },
      select: { field: true, value: true },
    });
    if (rows.length === 0) return '';
    return rows.map((r) => `${r.field} ${r.value}`).join(' ');
  }

  private async upsertRow(
    entityType: SearchIndexEntityType,
    entityId: string,
    row: {
      tenantId: string | null;
      mallId: string | null;
      title: string;
      status: string;
      slug: string | null;
      document: string;
      isFeatured: boolean;
      publishedAt: Date | null;
    },
  ): Promise<void> {
    await this.prisma.searchIndexEntry.upsert({
      where: { entityType_entityId: { entityType, entityId } },
      create: {
        entityType,
        entityId,
        tenantId: row.tenantId,
        mallId: row.mallId,
        title: row.title,
        status: row.status,
        slug: row.slug,
        document: row.document,
        isFeatured: row.isFeatured,
        publishedAt: row.publishedAt,
      },
      update: {
        tenantId: row.tenantId,
        mallId: row.mallId,
        title: row.title,
        status: row.status,
        slug: row.slug,
        document: row.document,
        isFeatured: row.isFeatured,
        publishedAt: row.publishedAt,
      },
    });
  }

  async syncPage(pageId: string): Promise<void> {
    const page = await this.prisma.page.findFirst({ where: { id: pageId } });
    if (!page || page.deletedAt) {
      await this.remove('PAGE', pageId);
      return;
    }
    const loc = await this.translationBlob(page.tenantId, 'PAGE', page.id);
    const blocks = await this.prisma.pageBlock.findMany({
      where: { pageId: page.id, deletedAt: null },
      select: { title: true, type: true, dataJson: true },
    });
    const blockText = blocks
      .map((b) => [b.title, b.type, jsonSnippet(b.dataJson)].filter(Boolean).join(' '))
      .join(' ');
    const document = this.normalizer.buildDocument([
      page.title,
      page.slug,
      page.seoTitle,
      page.seoDescription,
      page.seoKeywords,
      blockText,
      loc,
    ]);
    await this.upsertRow('PAGE', page.id, {
      tenantId: page.tenantId,
      mallId: page.mallId,
      title: page.title,
      status: page.status,
      slug: page.slug,
      document,
      isFeatured: false,
      publishedAt: page.publishedAt,
    });
  }

  async syncEvent(eventId: string): Promise<void> {
    const row = await this.prisma.event.findFirst({ where: { id: eventId } });
    if (!row || row.deletedAt) {
      await this.remove('EVENT', eventId);
      return;
    }
    const loc = await this.translationBlob(row.tenantId, 'EVENT', row.id);
    const document = this.normalizer.buildDocument([
      row.title,
      row.slug,
      row.shortDescription,
      row.description,
      row.category,
      row.location,
      row.buttonText,
      row.linkUrl,
      loc,
    ]);
    await this.upsertRow('EVENT', row.id, {
      tenantId: row.tenantId,
      mallId: row.mallId,
      title: row.title,
      status: row.status,
      slug: row.slug,
      document,
      isFeatured: false,
      publishedAt: row.publishedAt,
    });
  }

  async syncCampaign(campaignId: string): Promise<void> {
    const row = await this.prisma.campaign.findFirst({ where: { id: campaignId } });
    if (!row || row.deletedAt) {
      await this.remove('CAMPAIGN', campaignId);
      return;
    }
    const loc = await this.translationBlob(row.tenantId, 'CAMPAIGN', row.id);
    const document = this.normalizer.buildDocument([
      row.title,
      row.slug,
      row.shortDescription,
      row.description,
      row.terms,
      row.buttonText,
      row.linkUrl,
      row.couponCode,
      loc,
    ]);
    await this.upsertRow('CAMPAIGN', row.id, {
      tenantId: row.tenantId,
      mallId: row.mallId,
      title: row.title,
      status: row.status,
      slug: row.slug,
      document,
      isFeatured: false,
      publishedAt: row.publishedAt,
    });
  }

  async syncSlider(sliderId: string): Promise<void> {
    const row = await this.prisma.slider.findFirst({ where: { id: sliderId } });
    if (!row || row.deletedAt) {
      await this.remove('SLIDER', sliderId);
      return;
    }
    const loc = await this.translationBlob(row.tenantId, 'SLIDER', row.id);
    const document = this.normalizer.buildDocument([
      row.title,
      row.subtitle,
      row.description,
      row.buttonText,
      row.linkValue,
      String(row.linkType),
      loc,
    ]);
    await this.upsertRow('SLIDER', row.id, {
      tenantId: row.tenantId,
      mallId: row.mallId,
      title: row.title,
      status: row.status,
      slug: null,
      document,
      isFeatured: false,
      publishedAt: null,
    });
  }

  async syncGlobalStore(storeId: string): Promise<void> {
    const row = await this.prisma.globalStore.findFirst({ where: { id: storeId } });
    if (!row || row.deletedAt) {
      await this.remove('GLOBAL_STORE', storeId);
      return;
    }
    const document = this.normalizer.buildDocument([
      row.name,
      row.slug,
      row.description,
      row.websiteUrl,
      jsonSnippet(row.socialLinksJson),
    ]);
    await this.upsertRow('GLOBAL_STORE', row.id, {
      tenantId: null,
      mallId: null,
      title: row.name,
      status: row.status,
      slug: row.slug,
      document,
      isFeatured: false,
      publishedAt: null,
    });
  }

  async syncMallStore(mallStoreId: string): Promise<void> {
    const row = await this.prisma.mallStore.findFirst({
      where: { id: mallStoreId },
      include: { globalStore: true },
    });
    if (!row || row.deletedAt || !row.globalStore || row.globalStore.deletedAt) {
      await this.remove('MALL_STORE', mallStoreId);
      return;
    }
    const loc = await this.translationBlob(row.tenantId, 'STORE', row.id);
    const gs = row.globalStore;
    const document = this.normalizer.buildDocument([
      gs.name,
      gs.slug,
      gs.description,
      row.localName,
      row.localDescription,
      row.floor,
      row.storeNo,
      row.phone,
      row.email,
      loc,
    ]);
    await this.upsertRow('MALL_STORE', row.id, {
      tenantId: row.tenantId,
      mallId: row.mallId,
      title: row.localName?.trim() ? row.localName : gs.name,
      status: row.status,
      slug: gs.slug,
      document,
      isFeatured: row.isFeatured,
      publishedAt: null,
    });
  }

  async syncMovie(movieId: string): Promise<void> {
    const row = await this.prisma.movie.findFirst({ where: { id: movieId } });
    if (!row || row.deletedAt) {
      await this.remove('MOVIE', movieId);
      return;
    }
    const loc = await this.translationBlob(row.tenantId, 'MOVIE', row.id);
    const document = this.normalizer.buildDocument([
      row.title,
      row.slug,
      row.originalTitle,
      row.description,
      row.genre,
      row.rating,
      row.trailerUrl,
      loc,
    ]);
    await this.upsertRow('MOVIE', row.id, {
      tenantId: row.tenantId,
      mallId: null,
      title: row.title,
      status: row.status,
      slug: row.slug,
      document,
      isFeatured: false,
      publishedAt: row.releaseDate,
    });
  }

  async syncCinema(cinemaId: string): Promise<void> {
    const row = await this.prisma.cinema.findFirst({ where: { id: cinemaId } });
    if (!row || row.deletedAt) {
      await this.remove('CINEMA', cinemaId);
      return;
    }
    const loc = await this.translationBlob(row.tenantId, 'CINEMA', row.id);
    const document = this.normalizer.buildDocument([
      row.name,
      row.slug,
      row.description,
      String(row.providerType),
      jsonSnippet(row.providerConfigJson),
      loc,
    ]);
    await this.upsertRow('CINEMA', row.id, {
      tenantId: row.tenantId,
      mallId: row.mallId,
      title: row.name,
      status: row.status,
      slug: row.slug,
      document,
      isFeatured: false,
      publishedAt: null,
    });
  }

  /** Re-sync search row when translations change (entity type from LocalizedEntityType). */
  async syncFromLocalizedEntity(
    _tenantId: string,
    entityType: LocalizedEntityType,
    entityId: string,
  ): Promise<void> {
    const map: Record<LocalizedEntityType, () => Promise<void>> = {
      PAGE: () => this.syncPage(entityId),
      PAGE_BLOCK: async () => {
        const b = await this.prisma.pageBlock.findFirst({ where: { id: entityId }, select: { pageId: true } });
        if (b?.pageId) await this.syncPage(b.pageId);
      },
      EVENT: () => this.syncEvent(entityId),
      CAMPAIGN: () => this.syncCampaign(entityId),
      SLIDER: () => this.syncSlider(entityId),
      STORE: () => this.syncMallStore(entityId),
      MOVIE: () => this.syncMovie(entityId),
      CINEMA: () => this.syncCinema(entityId),
      LOCATION: async () => { /* Location search sync reserved for future sprint */ },
    };
    const fn = map[entityType];
    if (!fn) return;
    try {
      await fn();
    } catch (e) {
      this.log.warn(`search index sync failed (${entityType} ${entityId}): ${String(e)}`);
    }
  }

  async touchByLocalizedEntity(
    tenantId: string,
    entityType: LocalizedEntityType,
    entityId: string,
  ): Promise<void> {
    await this.syncFromLocalizedEntity(tenantId, entityType, entityId);
  }
}
