import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MediaFolder, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import type { CreateFolderDto } from './dto/create-folder.dto';
import type { UpdateFolderDto } from './dto/update-folder.dto';
import type { ListFoldersDto } from './dto/list-media.dto';

export type FolderResponse = Pick<
  MediaFolder,
  'id' | 'tenantId' | 'mallId' | 'parentId' | 'name' | 'slug' | 'sortOrder' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class MediaFolderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async createFolder(dto: CreateFolderDto, user: User, tenantId: string): Promise<FolderResponse> {
    if (dto.parentId) {
      const parent = await this.prisma.mediaFolder.findFirst({
        where: { id: dto.parentId, tenantId, deletedAt: null },
      });
      if (!parent) throw new NotFoundException('Parent folder not found');
    }

    const slug = this.slugify(dto.name);

    const folder = await this.prisma.mediaFolder.create({
      data: {
        tenantId,
        mallId: dto.mallId ?? null,
        parentId: dto.parentId ?? null,
        name: dto.name,
        slug,
        createdBy: user.id,
      },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'media-folder:create',
      entityType: 'media_folder',
      entityId: folder.id,
      after: { name: folder.name, parentId: folder.parentId },
    });

    return this.toResponse(folder);
  }

  async listFolders(tenantId: string, query: ListFoldersDto): Promise<FolderResponse[]> {
    const folders = await this.prisma.mediaFolder.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(query.parentId !== undefined ? { parentId: query.parentId } : { parentId: null }),
        ...(query.mallId !== undefined ? { mallId: query.mallId } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return folders.map((f) => this.toResponse(f));
  }

  async getFolder(id: string, tenantId: string): Promise<FolderResponse> {
    const folder = await this.prisma.mediaFolder.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!folder) throw new NotFoundException('Folder not found');
    return this.toResponse(folder);
  }

  async updateFolder(id: string, dto: UpdateFolderDto, user: User, tenantId: string): Promise<FolderResponse> {
    const folder = await this.prisma.mediaFolder.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!folder) throw new NotFoundException('Folder not found');

    const before = this.toResponse(folder);
    const updated = await this.prisma.mediaFolder.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name, slug: this.slugify(dto.name) } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'media-folder:update',
      entityType: 'media_folder',
      entityId: folder.id,
      before,
      after: this.toResponse(updated),
    });

    return this.toResponse(updated);
  }

  async deleteFolder(id: string, user: User, tenantId: string): Promise<void> {
    const folder = await this.prisma.mediaFolder.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!folder) throw new NotFoundException('Folder not found');

    const [assetCount, childCount] = await Promise.all([
      this.prisma.mediaAsset.count({ where: { folderId: id, deletedAt: null } }),
      this.prisma.mediaFolder.count({ where: { parentId: id, deletedAt: null } }),
    ]);

    if (assetCount > 0 || childCount > 0) {
      throw new BadRequestException('Cannot delete a folder that contains assets or subfolders');
    }

    await this.prisma.mediaFolder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'media-folder:delete',
      entityType: 'media_folder',
      entityId: folder.id,
      before: { name: folder.name },
    });
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }

  private toResponse(folder: MediaFolder): FolderResponse {
    return {
      id: folder.id,
      tenantId: folder.tenantId,
      mallId: folder.mallId,
      parentId: folder.parentId,
      name: folder.name,
      slug: folder.slug,
      sortOrder: folder.sortOrder,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
  }
}
