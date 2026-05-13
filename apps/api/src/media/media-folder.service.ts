import { Injectable, NotFoundException } from '@nestjs/common';
import type { MediaFolder, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFolderDto } from './dto/create-folder.dto';
import type { ListFoldersDto } from './dto/list-media.dto';

export type FolderResponse = Pick<
  MediaFolder,
  'id' | 'tenantId' | 'mallId' | 'parentId' | 'name' | 'slug' | 'createdAt'
>;

@Injectable()
export class MediaFolderService {
  constructor(private readonly prisma: PrismaService) {}

  async createFolder(dto: CreateFolderDto, user: User, tenantId: string): Promise<FolderResponse> {
    if (dto.parentId) {
      const parent = await this.prisma.mediaFolder.findFirst({
        where: { id: dto.parentId, tenantId },
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

    return this.toResponse(folder);
  }

  async listFolders(tenantId: string, query: ListFoldersDto): Promise<FolderResponse[]> {
    const folders = await this.prisma.mediaFolder.findMany({
      where: {
        tenantId,
        ...(query.parentId !== undefined ? { parentId: query.parentId } : { parentId: null }),
        ...(query.mallId !== undefined ? { mallId: query.mallId } : {}),
      },
      orderBy: { name: 'asc' },
    });

    return folders.map((f) => this.toResponse(f));
  }

  async getFolder(id: string, tenantId: string): Promise<FolderResponse> {
    const folder = await this.prisma.mediaFolder.findFirst({
      where: { id, tenantId },
    });
    if (!folder) throw new NotFoundException('Folder not found');
    return this.toResponse(folder);
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
      createdAt: folder.createdAt,
    };
  }
}
