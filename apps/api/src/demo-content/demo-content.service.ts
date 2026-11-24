import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { AuditLogService } from '../audit/audit.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { EventsService } from '../events/events.service';
import { GlobalStoresService } from '../global-stores/global-stores.service';
import { SOURCE_SYSTEM } from '../metrogarden-import/helpers';
import { MetrogardenImporter } from '../metrogarden-import/importer';
import type { ImportReport, MetrogardenExport } from '../metrogarden-import/types';
import { MallStoresService } from '../mall-stores/mall-stores.service';
import { MediaService } from '../media/media.service';
import { MoviesService } from '../movies/movies.service';
import { MovieSessionsService } from '../movie-sessions/movie-sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import { SlidersService } from '../sliders/sliders.service';
import { StoreCategoriesService } from '../store-categories/store-categories.service';
import { loadMetrogardenDemoFixture } from './demo-content.fixture';

export type DemoPreviewResponse = {
  tenant: { id: string; name: string; slug: string };
  mall: { id: string; name: string; slug: string; displayName: string | null };
  targetMallName: string;
  shiftDates: boolean;
  dateShiftDays: number;
  sourceSystem: string;
  counts: ImportReport['counts'];
  expiredAsDraft: ImportReport['expiredAsDraft'];
  unmatchedStoreRefs: ImportReport['unmatchedStoreRefs'];
  unsupportedFields: ImportReport['unsupportedFields'];
  textReplacements: ImportReport['textReplacements'];
  publicVisibility: ImportReport['publicVisibility'];
  media: ImportReport['media'];
  rowSummary: Record<string, number>;
  existingDemoMappings: number;
  errors: string[];
  note: string;
};

@Injectable()
export class DemoContentService {
  private readonly logger = new Logger(DemoContentService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditLogService,
    private readonly media: MediaService,
    private readonly globalStores: GlobalStoresService,
    private readonly mallStores: MallStoresService,
    private readonly storeCategories: StoreCategoriesService,
    private readonly campaigns: CampaignsService,
    private readonly events: EventsService,
    private readonly movies: MoviesService,
    private readonly movieSessions: MovieSessionsService,
    private readonly sliders: SlidersService,
  ) {}

  private services() {
    return {
      prisma: this.prisma,
      media: this.media,
      globalStores: this.globalStores,
      mallStores: this.mallStores,
      storeCategories: this.storeCategories,
      campaigns: this.campaigns,
      events: this.events,
      movies: this.movies,
      movieSessions: this.movieSessions,
      sliders: this.sliders,
    };
  }

  private targetMallName(mall: { name: string; displayName: string | null }): string {
    return (mall.displayName ?? mall.name).trim() || 'Demo AVM';
  }

  private async assertMallScope(user: User, tenantId: string, mallId: string) {
    await this.access.assertMallAccess(user, tenantId, mallId);
    const mall = await this.prisma.mall.findFirst({
      where: { id: mallId, tenantId, deletedAt: null },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    if (!mall) throw new NotFoundException('Lokasyon bulunamadı');
    return mall;
  }

  private loadFixture(): MetrogardenExport {
    return loadMetrogardenDemoFixture();
  }

  private summarizeRows(report: ImportReport): Record<string, number> {
    return report.rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});
  }

  async previewImport(
    user: User,
    tenantId: string,
    mallId: string,
    shiftDates = false,
  ): Promise<DemoPreviewResponse> {
    const mall = await this.assertMallScope(user, tenantId, mallId);
    const targetMallName = this.targetMallName(mall);
    const data = this.loadFixture();
    const importer = new MetrogardenImporter(
      this.services(),
      user,
      {
        input: 'fixture',
        tenantId,
        mallId,
        mode: 'dry-run',
        siteBaseUrl: 'https://metrogarden.hanbeyoglu.com',
        targetMallName,
        shiftDates,
      },
      data,
    );
    const report = await importer.run();
    const existingDemoMappings = await this.prisma.contentImportMapping.count({
      where: { tenantId, mallId, sourceSystem: SOURCE_SYSTEM },
    });

    return {
      tenant: mall.tenant,
      mall: {
        id: mall.id,
        name: mall.name,
        slug: mall.slug,
        displayName: mall.displayName,
      },
      targetMallName: report.targetMallName,
      shiftDates: report.shiftDates,
      dateShiftDays: report.dateShiftDays,
      sourceSystem: SOURCE_SYSTEM,
      counts: report.counts,
      expiredAsDraft: report.expiredAsDraft,
      unmatchedStoreRefs: report.unmatchedStoreRefs,
      unsupportedFields: report.unsupportedFields,
      textReplacements: report.textReplacements,
      publicVisibility: report.publicVisibility,
      media: report.media,
      rowSummary: this.summarizeRows(report),
      existingDemoMappings,
      errors: report.errors,
      note:
        'Kaynak fixture örnek demo içeriğidir; marka/mağaza adları örnek olarak kalır ve kayıtlar isDemo olarak işaretlenir. Kaynak tenantId/mallId kullanılmaz.',
    };
  }

  async startImport(user: User, tenantId: string, mallId: string, shiftDates = false) {
    const mall = await this.assertMallScope(user, tenantId, mallId);
    const lockKey = `${tenantId}:${mallId}:import`;
    if (this.running.has(lockKey)) {
      throw new BadRequestException('Bu lokasyon için zaten devam eden bir demo işlemi var');
    }

    const batch = await this.prisma.demoContentBatch.create({
      data: {
        tenantId,
        mallId,
        sourceSystem: SOURCE_SYSTEM,
        action: 'IMPORT',
        status: 'PENDING',
        createdBy: user.id,
      },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'demo-content:import:start',
      entityType: 'demo_content_batch',
      entityId: batch.id,
      after: {
        mallName: mall.name,
        targetMallName: this.targetMallName(mall),
        sourceSystem: SOURCE_SYSTEM,
        shiftDates,
      },
    });

    this.running.add(lockKey);
    void this.runImport(batch.id, user, tenantId, mallId, this.targetMallName(mall), shiftDates, lockKey);

    return {
      batchId: batch.id,
      status: batch.status,
      tenant: mall.tenant,
      mall: { id: mall.id, name: mall.name, slug: mall.slug, displayName: mall.displayName },
      shiftDates,
    };
  }

  private async runImport(
    batchId: string,
    user: User,
    tenantId: string,
    mallId: string,
    targetMallName: string,
    shiftDates: boolean,
    lockKey: string,
  ): Promise<void> {
    try {
      await this.prisma.demoContentBatch.update({
        where: { id: batchId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const data = this.loadFixture();
      const importer = new MetrogardenImporter(
        this.services(),
        user,
        {
          input: 'fixture',
          tenantId,
          mallId,
          mode: 'apply',
          siteBaseUrl: 'https://metrogarden.hanbeyoglu.com',
          batchId,
          targetMallName,
          shiftDates,
        },
        data,
      );
      const report = await importer.run();

      await this.prisma.demoContentBatch.update({
        where: { id: batchId },
        data: {
          status: report.errors.length ? 'FAILED' : 'COMPLETED',
          finishedAt: new Date(),
          reportJson: report as unknown as Prisma.InputJsonValue,
          errorMessage: report.errors.length ? report.errors.slice(0, 5).join(' | ') : null,
        },
      });

      await this.audit.logAction({
        userId: user.id,
        tenantId,
        mallId,
        action: 'demo-content:import:finish',
        entityType: 'demo_content_batch',
        entityId: batchId,
        success: report.errors.length === 0,
        after: {
          rowSummary: this.summarizeRows(report),
          media: report.media,
          publicVisibility: report.publicVisibility,
          shiftDates: report.shiftDates,
          errorCount: report.errors.length,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Demo import failed batch=${batchId}: ${message}`);
      await this.prisma.demoContentBatch.update({
        where: { id: batchId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorMessage: message,
        },
      });
      await this.audit.logAction({
        userId: user.id,
        tenantId,
        mallId,
        action: 'demo-content:import:finish',
        entityType: 'demo_content_batch',
        entityId: batchId,
        success: false,
        after: { error: message },
      });
    } finally {
      this.running.delete(lockKey);
    }
  }

  async getBatch(user: User, tenantId: string, mallId: string, batchId: string) {
    await this.assertMallScope(user, tenantId, mallId);
    const batch = await this.prisma.demoContentBatch.findFirst({
      where: { id: batchId, tenantId, mallId },
    });
    if (!batch) throw new NotFoundException('Demo batch bulunamadı');
    return batch;
  }

  async listBatches(user: User, tenantId: string, mallId: string) {
    await this.assertMallScope(user, tenantId, mallId);
    return this.prisma.demoContentBatch.findMany({
      where: { tenantId, mallId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        action: true,
        status: true,
        sourceSystem: true,
        createdAt: true,
        finishedAt: true,
        errorMessage: true,
      },
    });
  }

  async removeDemo(user: User, tenantId: string, mallId: string) {
    const mall = await this.assertMallScope(user, tenantId, mallId);
    const mappings = await this.prisma.contentImportMapping.findMany({
      where: { tenantId, mallId, sourceSystem: SOURCE_SYSTEM },
      orderBy: { createdAt: 'asc' },
    });

    const deleted: Record<string, number> = {};
    const errors: string[] = [];
    const mediaIds: string[] = [];

    // Delete in reverse dependency order (demo batch only)
    const order = [
      'movie_session',
      'slider_item',
      'slider',
      'campaign',
      'event',
      'movie',
      'mall_store',
      'store_category',
      'media',
      'global_store',
    ];

    for (const entityType of order) {
      const rows = mappings.filter((m) => m.entityType === entityType);
      for (const row of rows) {
        try {
          await this.deleteMappedEntity(user, tenantId, mallId, row.entityType, row.entityId, mediaIds);
          deleted[entityType] = (deleted[entityType] ?? 0) + 1;
        } catch (err) {
          errors.push(`${entityType}:${row.sourceKey} → ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    // Unused demo media cleanup
    let mediaDeleted = 0;
    for (const mediaId of [...new Set(mediaIds)]) {
      const stillUsed = await this.mediaStillReferenced(mediaId);
      if (stillUsed) continue;
      try {
        await this.media.deleteAsset(mediaId, user, tenantId);
        mediaDeleted += 1;
      } catch {
        // keep shared/referenced media
      }
    }

    await this.prisma.contentImportMapping.deleteMany({
      where: { tenantId, mallId, sourceSystem: SOURCE_SYSTEM },
    });

    const batch = await this.prisma.demoContentBatch.create({
      data: {
        tenantId,
        mallId,
        sourceSystem: SOURCE_SYSTEM,
        action: 'REMOVE',
        status: errors.length ? 'FAILED' : 'COMPLETED',
        createdBy: user.id,
        startedAt: new Date(),
        finishedAt: new Date(),
        reportJson: { deleted, mediaDeleted, errors } as Prisma.InputJsonValue,
        errorMessage: errors.length ? errors.slice(0, 5).join(' | ') : null,
      },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'demo-content:remove',
      entityType: 'demo_content_batch',
      entityId: batch.id,
      success: errors.length === 0,
      after: { deleted, mediaDeleted, mallName: mall.name, errorCount: errors.length },
    });

    return {
      batchId: batch.id,
      tenant: mall.tenant,
      mall: { id: mall.id, name: mall.name, slug: mall.slug, displayName: mall.displayName },
      deleted,
      mediaDeleted,
      errors,
    };
  }

  private async deleteMappedEntity(
    user: User,
    tenantId: string,
    mallId: string,
    entityType: string,
    entityId: string,
    mediaIds: string[],
  ): Promise<void> {
    const req = { tenantId, mallId } as import('express').Request;
    switch (entityType) {
      case 'movie_session': {
        const session = await this.prisma.movieSession.findFirst({
          where: { id: entityId, tenantId, mallId, deletedAt: null },
          select: { id: true },
        });
        if (!session) return;
        await this.movieSessions.remove(session.id, user, tenantId, mallId);
        return;
      }
      case 'campaign':
        await this.campaigns.remove(entityId, user, tenantId, mallId);
        return;
      case 'event':
        await this.events.remove(entityId, user, tenantId, mallId);
        return;
      case 'movie':
        await this.movies.remove(entityId, user, tenantId);
        return;
      case 'slider_item': {
        const item = await this.prisma.sliderItem.findFirst({
          where: { id: entityId, deletedAt: null },
          select: { id: true, sliderId: true, sharedImageId: true },
        });
        if (!item) return;
        if (item.sharedImageId) mediaIds.push(item.sharedImageId);
        await this.sliders.removeItem(item.sliderId, item.id, user, tenantId);
        return;
      }
      case 'slider':
        await this.sliders.remove(entityId, user, tenantId);
        return;
      case 'mall_store': {
        const store = await this.prisma.mallStore.findFirst({
          where: { id: entityId, tenantId, mallId, deletedAt: null },
          select: { id: true, localLogoMediaId: true },
        });
        if (!store) return;
        if (store.localLogoMediaId) mediaIds.push(store.localLogoMediaId);
        await this.mallStores.remove(req, user, store.id);
        return;
      }
      case 'store_category': {
        const linked = await this.prisma.mallStore.count({
          where: { categoryId: entityId, deletedAt: null },
        });
        if (linked > 0) return;
        await this.storeCategories.remove(req, user, entityId);
        return;
      }
      case 'media':
        mediaIds.push(entityId);
        return;
      case 'global_store': {
        // Only archive if no remaining mall assignments
        const linked = await this.prisma.mallStore.count({
          where: { globalStoreId: entityId, deletedAt: null },
        });
        if (linked > 0) return;
        await this.globalStores.update(entityId, { status: 'ARCHIVED' }, user);
        return;
      }
      default:
        return;
    }
  }

  private async mediaStillReferenced(mediaId: string): Promise<boolean> {
    const checks = await Promise.all([
      this.prisma.campaign.count({
        where: {
          deletedAt: null,
          OR: [{ sharedCoverImageId: mediaId }, { sharedMobileCoverImageId: mediaId }],
        },
      }),
      this.prisma.event.count({ where: { deletedAt: null, sharedCoverImageId: mediaId } }),
      this.prisma.movie.count({ where: { deletedAt: null, posterMediaId: mediaId } }),
      this.prisma.sliderItem.count({
        where: {
          deletedAt: null,
          OR: [{ sharedImageId: mediaId }, { sharedMobileImageId: mediaId }],
        },
      }),
      this.prisma.mallStore.count({ where: { deletedAt: null, localLogoMediaId: mediaId } }),
      this.prisma.globalStore.count({ where: { deletedAt: null, logoMediaId: mediaId } }),
    ]);
    return checks.some((n) => n > 0);
  }

  async previewReset(user: User, tenantId: string, mallId: string) {
    if (!user.isSuperAdmin) {
      throw new ForbiddenException('AVM içerik sıfırlama yalnızca Super Admin içindir');
    }
    const mall = await this.assertMallScope(user, tenantId, mallId);
    const [
      campaigns,
      events,
      mallStores,
      sliders,
      popups,
      pages,
      services,
      movieSessions,
      demoMappings,
    ] = await Promise.all([
      this.prisma.campaign.count({ where: { tenantId, mallId, deletedAt: null } }),
      this.prisma.event.count({ where: { tenantId, mallId, deletedAt: null } }),
      this.prisma.mallStore.count({ where: { tenantId, mallId, deletedAt: null } }),
      this.prisma.slider.count({ where: { tenantId, mallId, deletedAt: null } }),
      this.prisma.popup.count({ where: { tenantId, mallId, deletedAt: null } }),
      this.prisma.page.count({ where: { tenantId, mallId, deletedAt: null } }),
      this.prisma.service.count({ where: { tenantId, mallId, deletedAt: null } }),
      this.prisma.movieSession.count({ where: { tenantId, mallId, deletedAt: null } }),
      this.prisma.contentImportMapping.count({
        where: { tenantId, mallId, sourceSystem: SOURCE_SYSTEM },
      }),
    ]);

    return {
      tenant: mall.tenant,
      mall: {
        id: mall.id,
        name: mall.name,
        slug: mall.slug,
        displayName: mall.displayName,
      },
      confirmHint: mall.name,
      counts: {
        campaigns,
        events,
        mallStores,
        sliders,
        popups,
        pages,
        services,
        movieSessions,
        demoMappings,
      },
      preserved: [
        'tenant',
        'mall',
        'users',
        'roles',
        'apiKeys',
        'licenses',
        'locales',
        'allowedDomains',
        'settings',
        'mallFloors',
      ],
    };
  }

  async resetMallContent(
    user: User,
    tenantId: string,
    mallId: string,
    confirmName: string,
    confirmAgain: boolean,
  ) {
    if (!user.isSuperAdmin) {
      throw new ForbiddenException('AVM içerik sıfırlama yalnızca Super Admin içindir');
    }
    if (!confirmAgain) {
      throw new BadRequestException('İkinci onay (confirmAgain=true) zorunludur');
    }
    const preview = await this.previewReset(user, tenantId, mallId);
    if (confirmName.trim() !== preview.confirmHint) {
      throw new BadRequestException(`Onay için lokasyon adını aynen yazın: ${preview.confirmHint}`);
    }

    const now = new Date();
    const soft = { deletedAt: now, updatedAt: now };

    const [campaigns, events, mallStores, sliders, popups, pages, services, movieSessions] =
      await this.prisma.$transaction([
        this.prisma.campaign.updateMany({
          where: { tenantId, mallId, deletedAt: null },
          data: soft,
        }),
        this.prisma.event.updateMany({
          where: { tenantId, mallId, deletedAt: null },
          data: soft,
        }),
        this.prisma.mallStore.updateMany({
          where: { tenantId, mallId, deletedAt: null },
          data: soft,
        }),
        this.prisma.slider.updateMany({
          where: { tenantId, mallId, deletedAt: null },
          data: soft,
        }),
        this.prisma.popup.updateMany({
          where: { tenantId, mallId, deletedAt: null },
          data: soft,
        }),
        this.prisma.page.updateMany({
          where: { tenantId, mallId, deletedAt: null },
          data: soft,
        }),
        this.prisma.service.updateMany({
          where: { tenantId, mallId, deletedAt: null },
          data: soft,
        }),
        this.prisma.movieSession.updateMany({
          where: { tenantId, mallId, deletedAt: null },
          data: soft,
        }),
      ]);

    await this.prisma.contentImportMapping.deleteMany({
      where: { tenantId, mallId, sourceSystem: SOURCE_SYSTEM },
    });

    const deleted = {
      campaigns: campaigns.count,
      events: events.count,
      mallStores: mallStores.count,
      sliders: sliders.count,
      popups: popups.count,
      pages: pages.count,
      services: services.count,
      movieSessions: movieSessions.count,
    };

    const batch = await this.prisma.demoContentBatch.create({
      data: {
        tenantId,
        mallId,
        sourceSystem: SOURCE_SYSTEM,
        action: 'RESET',
        status: 'COMPLETED',
        createdBy: user.id,
        startedAt: now,
        finishedAt: new Date(),
        reportJson: { deleted, preserved: preview.preserved } as Prisma.InputJsonValue,
      },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'demo-content:reset',
      entityType: 'demo_content_batch',
      entityId: batch.id,
      severity: 'CRITICAL',
      after: { deleted, mallName: preview.mall.name },
    });

    return {
      batchId: batch.id,
      tenant: preview.tenant,
      mall: preview.mall,
      deleted,
      preserved: preview.preserved,
    };
  }
}
