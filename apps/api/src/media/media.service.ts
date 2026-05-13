import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MediaAsset, User } from '@prisma/client';
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
  | 'storageKey'
  | 'publicUrl'
  | 'altText'
  | 'createdAt'
>;

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

  async listAssets(tenantId: string, query: ListMediaDto): Promise<{ assets: MediaAssetResponse[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 40;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      deletedAt: null,
      ...(query.folderId !== undefined ? { folderId: query.folderId } : {}),
      ...(query.mallId !== undefined ? { mallId: query.mallId } : {}),
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

  async deleteAsset(id: string, user: User, tenantId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Media asset not found');

    // Soft-delete first so the record is gone from queries immediately
    await this.prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Best-effort physical delete — failures are logged but don't roll back the soft-delete
    try {
      await this.storage.delete(asset.storageKey);
    } catch (err) {
      // Log but don't re-throw; the DB record is already soft-deleted
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
    // Prefer MIME-derived extension (canonical), fall back to filename extension
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
      where: { id: folderId, tenantId },
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
      storageKey: asset.storageKey,
      publicUrl: asset.publicUrl,
      altText: asset.altText,
      createdAt: asset.createdAt,
    };
  }
}
