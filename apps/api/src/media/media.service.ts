import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MediaAsset, MediaAssetStatus, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { StorageProvider } from './storage/storage.provider';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MIME_TO_EXTENSION,
} from './constants/media.constants';
import type { ListMediaDto } from './dto/list-media.dto';
import type { UpdateMediaDto } from './dto/update-media.dto';
import type { MoveMediaDto } from './dto/move-media.dto';

export interface UploadOptions {
  folderId?: string;
  mallId?: string;
  altText?: string;
}

export type MediaAssetResponse = Pick<
  MediaAsset,
  | 'id'
  | 'tenantId'
  | 'mallId'
  | 'folderId'
  | 'originalName'
  | 'fileName'
  | 'mimeType'
  | 'extension'
  | 'size'
  | 'width'
  | 'height'
  | 'durationSeconds'
  | 'storageKey'
  | 'publicUrl'
  | 'altText'
  | 'caption'
  | 'description'
  | 'tags'
  | 'focalPointX'
  | 'focalPointY'
  | 'dominantColor'
  | 'source'
  | 'checksum'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
>;

export interface MediaUsage {
  entityType: string;
  entityId: string;
  entityName: string;
  field: string;
  route?: string;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageProvider,
    private readonly audit: AuditLogService,
  ) {}

  async uploadAsset(
    file: Express.Multer.File,
    user: User,
    tenantId: string,
    options: UploadOptions,
  ): Promise<MediaAssetResponse> {
    this.validateFile(file);

    const ext = this.resolveExtension(file);
    const fileName = `${randomUUID()}.${ext}`;
    const key = this.buildStorageKey(tenantId, fileName);

    if (options.folderId) {
      await this.assertFolderBelongsToTenant(options.folderId, tenantId);
    }

    const { publicUrl } = await this.storage.upload({
      key,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
    });

    const asset = await this.prisma.mediaAsset.create({
      data: {
        tenantId,
        mallId: options.mallId ?? null,
        folderId: options.folderId ?? null,
        uploadedBy: user.id,
        originalName: file.originalname.slice(0, 255),
        fileName,
        mimeType: file.mimetype,
        extension: ext,
        size: file.size,
        storageKey: key,
        publicUrl,
        altText: options.altText ?? null,
        tags: [],
      },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: options.mallId,
      action: 'media:upload',
      entityType: 'media_asset',
      entityId: asset.id,
      after: { fileName, mimeType: file.mimetype, size: file.size },
    });

    return this.toResponse(asset);
  }

  async listAssets(
    tenantId: string,
    query: ListMediaDto,
  ): Promise<{ assets: MediaAssetResponse[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 40;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
      ...(query.folderId !== undefined ? { folderId: query.folderId } : {}),
      ...(query.mallId !== undefined ? { mallId: query.mallId } : {}),
      ...(query.mimeType ? { mimeType: { startsWith: query.mimeType } } : {}),
      ...(query.status ? { status: query.status } : { status: 'ACTIVE' }),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.search
        ? {
            OR: [
              { originalName: { contains: query.search, mode: 'insensitive' } },
              { altText: { contains: query.search, mode: 'insensitive' } },
              { caption: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [assets, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);

    return { assets: assets.map((a) => this.toResponse(a)), total };
  }

  async getAsset(id: string, tenantId: string): Promise<MediaAssetResponse> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Media asset not found');
    return this.toResponse(asset);
  }

  async updateAsset(
    id: string,
    dto: UpdateMediaDto,
    user: User,
    tenantId: string,
  ): Promise<MediaAssetResponse> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Media asset not found');

    const before = this.toResponse(asset);
    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        ...(dto.altText !== undefined ? { altText: dto.altText } : {}),
        ...(dto.caption !== undefined ? { caption: dto.caption } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.focalPointX !== undefined ? { focalPointX: dto.focalPointX } : {}),
        ...(dto.focalPointY !== undefined ? { focalPointY: dto.focalPointY } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'media:update',
      entityType: 'media_asset',
      entityId: asset.id,
      before,
      after: this.toResponse(updated),
    });

    return this.toResponse(updated);
  }

  async moveAsset(
    id: string,
    dto: MoveMediaDto,
    user: User,
    tenantId: string,
  ): Promise<MediaAssetResponse> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Media asset not found');

    if (dto.folderId) {
      await this.assertFolderBelongsToTenant(dto.folderId, tenantId);
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: { folderId: dto.folderId ?? null },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'media:move',
      entityType: 'media_asset',
      entityId: asset.id,
      before: { folderId: asset.folderId },
      after: { folderId: dto.folderId ?? null },
    });

    return this.toResponse(updated);
  }

  async getUsages(id: string, tenantId: string): Promise<MediaUsage[]> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Media asset not found');

    const usages: MediaUsage[] = [];

    const [
      slidersDesktop,
      slidersMobile,
      slidersVideo,
      globalStoreLogos,
      mallStoreLogos,
      eventCovers,
      campaignCovers,
      cinemaLogos,
      moviePosters,
      mallLogos,
      mallCovers,
    ] = await Promise.all([
      this.prisma.slider.findMany({
        where: { desktopMediaId: id, tenantId, deletedAt: null },
        select: { id: true, title: true, mallId: true },
      }),
      this.prisma.slider.findMany({
        where: { mobileMediaId: id, tenantId, deletedAt: null },
        select: { id: true, title: true, mallId: true },
      }),
      this.prisma.slider.findMany({
        where: { videoMediaId: id, tenantId, deletedAt: null },
        select: { id: true, title: true, mallId: true },
      }),
      this.prisma.globalStore.findMany({
        where: { logoMediaId: id, deletedAt: null },
        select: { id: true, name: true },
      }),
      this.prisma.mallStore.findMany({
        where: { localLogoMediaId: id, tenantId, deletedAt: null },
        select: { id: true, globalStoreId: true, globalStore: { select: { name: true } } },
      }),
      this.prisma.event.findMany({
        where: { coverMediaId: id, tenantId, deletedAt: null },
        select: { id: true, title: true, slug: true },
      }),
      this.prisma.campaign.findMany({
        where: { coverMediaId: id, tenantId, deletedAt: null },
        select: { id: true, title: true, slug: true },
      }),
      this.prisma.cinema.findMany({
        where: { logoMediaId: id, tenantId, deletedAt: null },
        select: { id: true, name: true },
      }),
      this.prisma.movie.findMany({
        where: { posterMediaId: id, tenantId, deletedAt: null },
        select: { id: true, title: true, slug: true },
      }),
      this.prisma.mall.findMany({
        where: { logoMediaId: id, tenantId, deletedAt: null },
        select: { id: true, name: true, slug: true },
      }),
      this.prisma.mall.findMany({
        where: { coverMediaId: id, tenantId, deletedAt: null },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    for (const s of slidersDesktop) {
      usages.push({ entityType: 'slider', entityId: s.id, entityName: s.title, field: 'desktopMedia', route: `/sliders/${s.id}` });
    }
    for (const s of slidersMobile) {
      usages.push({ entityType: 'slider', entityId: s.id, entityName: s.title, field: 'mobileMedia', route: `/sliders/${s.id}` });
    }
    for (const s of slidersVideo) {
      usages.push({ entityType: 'slider', entityId: s.id, entityName: s.title, field: 'videoMedia', route: `/sliders/${s.id}` });
    }
    for (const s of globalStoreLogos) {
      usages.push({ entityType: 'global_store', entityId: s.id, entityName: s.name, field: 'logo', route: `/stores/global/${s.id}` });
    }
    for (const s of mallStoreLogos) {
      const name = s.globalStore?.name ?? s.id;
      usages.push({ entityType: 'mall_store', entityId: s.id, entityName: name, field: 'localLogo', route: `/stores/${s.id}` });
    }
    for (const e of eventCovers) {
      usages.push({ entityType: 'event', entityId: e.id, entityName: e.title, field: 'coverMedia', route: `/events/${e.slug}` });
    }
    for (const c of campaignCovers) {
      usages.push({ entityType: 'campaign', entityId: c.id, entityName: c.title, field: 'coverMedia', route: `/campaigns/${c.slug}` });
    }
    for (const c of cinemaLogos) {
      usages.push({ entityType: 'cinema', entityId: c.id, entityName: c.name, field: 'logo', route: `/cinemas/${c.id}` });
    }
    for (const m of moviePosters) {
      usages.push({ entityType: 'movie', entityId: m.id, entityName: m.title, field: 'poster', route: `/movies/${m.slug}` });
    }
    for (const m of mallLogos) {
      usages.push({ entityType: 'location', entityId: m.id, entityName: m.name, field: 'logo', route: `/locations/${m.slug}` });
    }
    for (const m of mallCovers) {
      usages.push({ entityType: 'location', entityId: m.id, entityName: m.name, field: 'cover', route: `/locations/${m.slug}` });
    }

    return usages;
  }

  async deleteAsset(id: string, user: User, tenantId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Media asset not found');

    await this.prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    try {
      await this.storage.delete(asset.storageKey);
    } catch (err) {
      console.error(`Storage delete failed for key ${asset.storageKey}:`, err);
    }

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: asset.mallId ?? undefined,
      action: 'media:delete',
      entityType: 'media_asset',
      entityId: asset.id,
      before: { fileName: asset.fileName, storageKey: asset.storageKey },
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private validateFile(file: Express.Multer.File): void {
    if (!file) throw new BadRequestException('No file provided');

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const mb = MAX_FILE_SIZE_BYTES / 1024 / 1024;
      throw new BadRequestException(`File too large. Maximum size is ${mb} MB`);
    }

    const rawExt = path.extname(file.originalname).toLowerCase().slice(1);
    if (!ALLOWED_EXTENSIONS.has(rawExt)) {
      throw new BadRequestException(`Unsupported file extension ".${rawExt}"`);
    }
  }

  private resolveExtension(file: Express.Multer.File): string {
    return MIME_TO_EXTENSION[file.mimetype] ?? path.extname(file.originalname).toLowerCase().slice(1);
  }

  private buildStorageKey(tenantId: string, fileName: string): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `tenants/${tenantId}/media/${yyyy}/${mm}/${fileName}`;
  }

  private async assertFolderBelongsToTenant(folderId: string, tenantId: string): Promise<void> {
    const folder = await this.prisma.mediaFolder.findFirst({
      where: { id: folderId, tenantId, deletedAt: null },
    });
    if (!folder) throw new NotFoundException('Folder not found or does not belong to this tenant');
  }

  private toResponse(asset: MediaAsset): MediaAssetResponse {
    return {
      id: asset.id,
      tenantId: asset.tenantId,
      mallId: asset.mallId,
      folderId: asset.folderId,
      originalName: asset.originalName,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      extension: asset.extension,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      durationSeconds: asset.durationSeconds,
      storageKey: asset.storageKey,
      publicUrl: asset.publicUrl,
      altText: asset.altText,
      caption: asset.caption,
      description: asset.description,
      tags: asset.tags,
      focalPointX: asset.focalPointX,
      focalPointY: asset.focalPointY,
      dominantColor: asset.dominantColor,
      source: asset.source,
      checksum: asset.checksum,
      status: asset.status as MediaAssetStatus,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }
}
