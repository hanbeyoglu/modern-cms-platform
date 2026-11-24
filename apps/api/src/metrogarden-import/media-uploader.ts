import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import type { Prisma, User } from '@prisma/client';
import type { MediaService } from '../media/media.service';
import type { PrismaService } from '../prisma/prisma.service';
import { SOURCE_SYSTEM, urlHash } from './helpers';

export type MediaUploadStats = {
  uniqueUrls: number;
  wouldUpload: number;
  reused: number;
  uploaded: number;
  failed: number;
};

export class MediaUploader {
  private readonly cache = new Map<string, string>();
  readonly stats: MediaUploadStats = {
    uniqueUrls: 0,
    wouldUpload: 0,
    reused: 0,
    uploaded: 0,
    failed: 0,
  };
  readonly failures: Array<{ url: string; error: string }> = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly user: User,
    private readonly tenantId: string,
    private readonly mallId: string,
    private readonly dryRun: boolean,
    private readonly batchId?: string,
  ) {}

  async resolve(url: string | undefined, usageContext: string, altText?: string): Promise<string | undefined> {
    if (!url?.trim()) return undefined;
    const sourceUrl = url.trim();
    const hash = urlHash(sourceUrl);

    const cached = this.cache.get(hash);
    if (cached) {
      this.stats.reused += 1;
      return cached;
    }

    const mapped = await this.prisma.contentImportMapping.findUnique({
      where: {
        tenantId_sourceSystem_entityType_sourceKey: {
          tenantId: this.tenantId,
          sourceSystem: SOURCE_SYSTEM,
          entityType: 'media',
          sourceKey: hash,
        },
      },
    });
    if (mapped) {
      const existing = await this.prisma.mediaAsset.findFirst({
        where: { id: mapped.entityId, tenantId: this.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        this.cache.set(hash, existing.id);
        this.stats.reused += 1;
        return existing.id;
      }
    }

    const byChecksum = await this.prisma.mediaAsset.findFirst({
      where: {
        tenantId: this.tenantId,
        checksum: hash,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (byChecksum) {
      this.cache.set(hash, byChecksum.id);
      this.stats.reused += 1;
      if (!this.dryRun) {
        await this.upsertMapping('media', hash, byChecksum.id, { sourceUrl });
      }
      return byChecksum.id;
    }

    if (this.dryRun) {
      this.stats.wouldUpload += 1;
      const placeholder = `dry-run-media:${hash.slice(0, 12)}`;
      this.cache.set(hash, placeholder);
      return placeholder;
    }

    try {
      const downloaded = await this.download(sourceUrl);
      const file = {
        fieldname: 'file',
        originalname: downloaded.fileName,
        encoding: '7bit',
        mimetype: downloaded.mimeType,
        size: downloaded.buffer.length,
        buffer: downloaded.buffer,
        destination: '',
        filename: downloaded.fileName,
        path: '',
        stream: undefined as never,
      } as Express.Multer.File;

      const asset = await this.media.uploadAsset(file, this.user, this.tenantId, {
        mallId: this.mallId,
        altText,
        usageContext,
        tags: ['metrogarden-import', SOURCE_SYSTEM],
      });

      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          source: SOURCE_SYSTEM,
          checksum: hash,
          metadataJson: {
            importSourceUrl: sourceUrl,
            importSourceSystem: SOURCE_SYSTEM,
          } as Prisma.InputJsonValue,
        },
      });

      await this.upsertMapping('media', hash, asset.id, { sourceUrl });
      this.cache.set(hash, asset.id);
      this.stats.uploaded += 1;
      return asset.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.stats.failed += 1;
      this.failures.push({ url: sourceUrl, error: message });
      return undefined;
    }
  }

  private async download(url: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'modern-cms-metrogarden-import/1.0' },
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} downloading media`);
    }
    const mimeType = (response.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim();
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) throw new Error('Empty media response');

    const extFromUrl = extname(new URL(url).pathname).replace('.', '') || 'jpg';
    const extFromMime = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? extFromUrl;
    const fileName = `metrogarden-${createHash('sha1').update(url).digest('hex').slice(0, 12)}.${extFromMime}`;
    return { buffer, mimeType, fileName };
  }

  private async upsertMapping(
    entityType: string,
    sourceKey: string,
    entityId: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.contentImportMapping.upsert({
      where: {
        tenantId_sourceSystem_entityType_sourceKey: {
          tenantId: this.tenantId,
          sourceSystem: SOURCE_SYSTEM,
          entityType,
          sourceKey,
        },
      },
      create: {
        tenantId: this.tenantId,
        mallId: this.mallId,
        batchId: this.batchId ?? null,
        sourceSystem: SOURCE_SYSTEM,
        entityType,
        sourceKey,
        entityId,
        metaJson: meta as Prisma.InputJsonValue,
      },
      update: {
        entityId,
        mallId: this.mallId,
        batchId: this.batchId ?? null,
        metaJson: meta as Prisma.InputJsonValue,
      },
    });
  }
}
