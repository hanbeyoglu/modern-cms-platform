import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PageBlock, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { SearchIndexerService } from '../search/search-indexer.service';
import { validateBlockData } from '../common/utils/block-data-validation';
import type { CreatePageBlockDto } from './dto/create-page-block.dto';
import type { UpdatePageBlockDto } from './dto/update-page-block.dto';
import type { ReorderBlocksDto } from './dto/reorder-blocks.dto';

@Injectable()
export class PageBlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  private schedulePageSearchIndex(pageId: string): void {
    void this.searchIndexer.syncPage(pageId).catch(() => undefined);
  }

  async list(pageId: string, tenantId: string): Promise<PageBlock[]> {
    await this.assertPageExists(pageId, tenantId);
    return this.prisma.pageBlock.findMany({
      where: { pageId, tenantId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(
    pageId: string,
    dto: CreatePageBlockDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<PageBlock> {
    const page = await this.assertPageExists(pageId, tenantId);
    const data = dto.dataJson ?? {};
    validateBlockData(dto.type, data);

    const block = await this.prisma.pageBlock.create({
      data: {
        tenantId,
        mallId: page.mallId,
        pageId,
        type: dto.type,
        title: dto.title ?? null,
        dataJson: data as Prisma.InputJsonValue,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 'ACTIVE',
        createdBy: user.id,
      },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? page.mallId ?? undefined,
      action: 'page-block:create',
      entityType: 'page-block',
      entityId: block.id,
      after: { pageId, type: block.type, sortOrder: block.sortOrder },
    });

    this.schedulePageSearchIndex(pageId);
    return block;
  }

  async update(
    pageId: string,
    blockId: string,
    dto: UpdatePageBlockDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<PageBlock> {
    const page = await this.assertPageExists(pageId, tenantId);
    const existing = await this.assertBlockExists(blockId, pageId, tenantId);

    const nextType = dto.type ?? existing.type;
    const nextData =
      dto.dataJson !== undefined ? dto.dataJson : (existing.dataJson as Record<string, unknown>);

    if (dto.type !== undefined || dto.dataJson !== undefined) {
      validateBlockData(nextType, nextData ?? {});
    }

    const block = await this.prisma.pageBlock.update({
      where: { id: blockId },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.title !== undefined && { title: dto.title || null }),
        ...(dto.dataJson !== undefined && { dataJson: dto.dataJson as Prisma.InputJsonValue }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.status !== undefined && { status: dto.status }),
        updatedBy: user.id,
      },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? page.mallId ?? undefined,
      action: 'page-block:update',
      entityType: 'page-block',
      entityId: blockId,
      before: { type: existing.type, sortOrder: existing.sortOrder },
      after: { type: block.type, sortOrder: block.sortOrder },
    });

    this.schedulePageSearchIndex(pageId);
    return block;
  }

  async remove(
    pageId: string,
    blockId: string,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<void> {
    const page = await this.assertPageExists(pageId, tenantId);
    const existing = await this.assertBlockExists(blockId, pageId, tenantId);

    await this.prisma.pageBlock.update({
      where: { id: blockId },
      data: { deletedAt: new Date() },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? page.mallId ?? undefined,
      action: 'page-block:delete',
      entityType: 'page-block',
      entityId: blockId,
      before: { type: existing.type, sortOrder: existing.sortOrder },
    });

    this.schedulePageSearchIndex(pageId);
  }

  async reorder(
    pageId: string,
    dto: ReorderBlocksDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<PageBlock[]> {
    const page = await this.assertPageExists(pageId, tenantId);

    const blockIds = dto.blocks.map((b) => b.id);
    const existingBlocks = await this.prisma.pageBlock.findMany({
      where: { id: { in: blockIds }, pageId, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (existingBlocks.length !== blockIds.length) {
      throw new BadRequestException('One or more block IDs are invalid or do not belong to this page');
    }

    await this.prisma.$transaction(
      dto.blocks.map((item) =>
        this.prisma.pageBlock.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder, updatedBy: user.id },
        }),
      ),
    );

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? page.mallId ?? undefined,
      action: 'page-block:reorder',
      entityType: 'page-block',
      entityId: pageId,
      after: { blocks: dto.blocks },
    });

    this.schedulePageSearchIndex(pageId);

    return this.prisma.pageBlock.findMany({
      where: { pageId, tenantId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  private async assertPageExists(pageId: string, tenantId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, tenantId, deletedAt: null },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  private async assertBlockExists(
    blockId: string,
    pageId: string,
    tenantId: string,
  ): Promise<PageBlock> {
    const block = await this.prisma.pageBlock.findFirst({
      where: { id: blockId, pageId, tenantId, deletedAt: null },
    });
    if (!block) throw new NotFoundException('Page block not found');
    return block;
  }
}
