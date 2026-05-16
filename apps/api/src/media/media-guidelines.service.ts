import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantMediaGuideline, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import {
  DEFAULT_MEDIA_USAGE_PRESETS,
  MEDIA_USAGE_KEYS,
  formatAspectRatio,
  isMediaUsageKey,
  type MediaUsageKey,
  type MediaUsagePreset,
} from './constants/media-usage-presets';
import { UpdateMediaGuidelineDto } from './dto/update-media-guideline.dto';

export interface MediaGuidelineRow {
  usageKey: string;
  label: string;
  recommendedWidth: number;
  recommendedHeight: number;
  acceptedMimeTypes: string[];
  helperText: string | null;
  aspectRatioLocked: boolean;
  active: boolean;
  aspectRatio: string;
  source: 'tenant' | 'default';
  id: string | null;
}

@Injectable()
export class MediaGuidelinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async listMerged(tenantId: string): Promise<MediaGuidelineRow[]> {
    const rows = await this.prisma.tenantMediaGuideline.findMany({
      where: { tenantId },
      orderBy: { usageKey: 'asc' },
    });
    const byKey = new Map(rows.map((r) => [r.usageKey, r]));
    return MEDIA_USAGE_KEYS.map((usageKey) => {
      const preset = DEFAULT_MEDIA_USAGE_PRESETS[usageKey];
      const tenant = byKey.get(usageKey);
      if (tenant) return this.toRow(tenant, preset);
      return this.defaultRow(preset);
    });
  }

  async upsert(
    usageKey: string,
    dto: UpdateMediaGuidelineDto,
    user: User,
    tenantId: string,
  ): Promise<MediaGuidelineRow> {
    if (!isMediaUsageKey(usageKey)) {
      throw new BadRequestException(`Geçersiz kullanım anahtarı: ${usageKey}`);
    }

    const preset = DEFAULT_MEDIA_USAGE_PRESETS[usageKey];
    const existing = await this.prisma.tenantMediaGuideline.findUnique({
      where: { tenantId_usageKey: { tenantId, usageKey } },
    });

    const recommendedWidth = dto.recommendedWidth ?? existing?.recommendedWidth ?? preset.recommendedWidth;
    const recommendedHeight =
      dto.recommendedHeight ?? existing?.recommendedHeight ?? preset.recommendedHeight;

    const data = {
      recommendedWidth,
      recommendedHeight,
      acceptedMimeTypes:
        dto.acceptedMimeTypes ?? existing?.acceptedMimeTypes ?? preset.acceptedMimeTypes,
      helperText:
        dto.helperText !== undefined
          ? dto.helperText
          : (existing?.helperText ?? preset.helperText),
      aspectRatioLocked:
        dto.aspectRatioLocked ?? existing?.aspectRatioLocked ?? preset.aspectRatioLocked,
      active: dto.active ?? existing?.active ?? true,
    };

    const row = existing
      ? await this.prisma.tenantMediaGuideline.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.tenantMediaGuideline.create({
          data: { tenantId, usageKey, ...data },
        });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'media-guideline:update',
      entityType: 'TenantMediaGuideline',
      entityId: row.id,
      after: { usageKey, ...data },
    });

    return this.toRow(row, preset);
  }

  resolveFromRows(
    usageKey: string,
    mergedRows: MediaGuidelineRow[],
  ): MediaUsagePreset & { source: 'tenant' | 'default' } {
    const row = mergedRows.find((r) => r.usageKey === usageKey && r.active);
    if (row) {
      return {
        usageKey: row.usageKey as MediaUsageKey,
        label: row.label,
        recommendedWidth: row.recommendedWidth,
        recommendedHeight: row.recommendedHeight,
        acceptedMimeTypes: row.acceptedMimeTypes,
        helperText: row.helperText,
        aspectRatioLocked: row.aspectRatioLocked,
        source: row.source,
      };
    }

    if (isMediaUsageKey(usageKey)) {
      return { ...DEFAULT_MEDIA_USAGE_PRESETS[usageKey], source: 'default' };
    }

    return { ...DEFAULT_MEDIA_USAGE_PRESETS.SLIDER_DESKTOP, source: 'default' };
  }

  async seedDefaultsForTenant(tenantId: string): Promise<number> {
    let count = 0;
    for (const usageKey of MEDIA_USAGE_KEYS) {
      const preset = DEFAULT_MEDIA_USAGE_PRESETS[usageKey];
      await this.prisma.tenantMediaGuideline.upsert({
        where: { tenantId_usageKey: { tenantId, usageKey } },
        update: {},
        create: {
          tenantId,
          usageKey,
          recommendedWidth: preset.recommendedWidth,
          recommendedHeight: preset.recommendedHeight,
          acceptedMimeTypes: preset.acceptedMimeTypes,
          helperText: preset.helperText,
          aspectRatioLocked: preset.aspectRatioLocked,
          active: true,
        },
      });
      count += 1;
    }
    return count;
  }

  async getMergedRow(tenantId: string, usageKey: string): Promise<MediaGuidelineRow> {
    if (!isMediaUsageKey(usageKey)) {
      throw new NotFoundException('Medya kullanım ayarı bulunamadı');
    }
    const preset = DEFAULT_MEDIA_USAGE_PRESETS[usageKey];
    const tenant = await this.prisma.tenantMediaGuideline.findUnique({
      where: { tenantId_usageKey: { tenantId, usageKey } },
    });
    if (tenant) return this.toRow(tenant, preset);
    return this.defaultRow(preset);
  }

  private toRow(row: TenantMediaGuideline, preset: MediaUsagePreset): MediaGuidelineRow {
    return {
      id: row.id,
      usageKey: row.usageKey,
      label: preset.label,
      recommendedWidth: row.recommendedWidth,
      recommendedHeight: row.recommendedHeight,
      acceptedMimeTypes: row.acceptedMimeTypes,
      helperText: row.helperText,
      aspectRatioLocked: row.aspectRatioLocked,
      active: row.active,
      aspectRatio: formatAspectRatio(row.recommendedWidth, row.recommendedHeight),
      source: 'tenant',
    };
  }

  private defaultRow(preset: MediaUsagePreset): MediaGuidelineRow {
    return {
      id: null,
      usageKey: preset.usageKey,
      label: preset.label,
      recommendedWidth: preset.recommendedWidth,
      recommendedHeight: preset.recommendedHeight,
      acceptedMimeTypes: preset.acceptedMimeTypes,
      helperText: preset.helperText,
      aspectRatioLocked: preset.aspectRatioLocked,
      active: true,
      aspectRatio: formatAspectRatio(preset.recommendedWidth, preset.recommendedHeight),
      source: 'default',
    };
  }
}
