import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { RequireMallContext } from '../common/decorators/require-mall.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { PageBlocksService } from './page-blocks.service';
import { CreatePageBlockDto } from './dto/create-page-block.dto';
import { UpdatePageBlockDto } from './dto/update-page-block.dto';
import { ReorderBlocksDto } from './dto/reorder-blocks.dto';

@Controller('pages/:pageId/blocks')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class PageBlocksController {
  constructor(private readonly pageBlocks: PageBlocksService) {}

  @Get()
  @RequirePermission('page-block:read')
  list(@Param('pageId') pageId: string, @Req() req: Request) {
    return this.pageBlocks.list(pageId, req.tenantId!);
  }

  @Post()
  @RequirePermission('page-block:create')
  create(
    @Param('pageId') pageId: string,
    @Body() dto: CreatePageBlockDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.pageBlocks.create(pageId, dto, user, req.tenantId!, req.mallId);
  }

  @Patch('reorder')
  @RequirePermission('page-block:reorder')
  reorder(
    @Param('pageId') pageId: string,
    @Body() dto: ReorderBlocksDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.pageBlocks.reorder(pageId, dto, user, req.tenantId!, req.mallId);
  }

  @Patch(':blockId')
  @RequirePermission('page-block:update')
  update(
    @Param('pageId') pageId: string,
    @Param('blockId') blockId: string,
    @Body() dto: UpdatePageBlockDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.pageBlocks.update(pageId, blockId, dto, user, req.tenantId!, req.mallId);
  }

  @Delete(':blockId')
  @HttpCode(204)
  @RequirePermission('page-block:delete')
  async remove(
    @Param('pageId') pageId: string,
    @Param('blockId') blockId: string,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    await this.pageBlocks.remove(pageId, blockId, user, req.tenantId!, req.mallId);
  }
}
