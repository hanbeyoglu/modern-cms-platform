import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
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
import { SlidersService } from './sliders.service';
import { CreateSliderDto } from './dto/create-slider.dto';
import { UpdateSliderDto } from './dto/update-slider.dto';
import { ListSlidersDto } from './dto/list-sliders.dto';
import { ReorderSlidersDto } from './dto/reorder-sliders.dto';
import { CreateSliderItemDto } from './dto/create-slider-item.dto';
import { UpdateSliderItemDto } from './dto/update-slider-item.dto';
import { ReorderSliderItemsDto } from './dto/reorder-slider-items.dto';

@Controller('sliders')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class SlidersController {
  constructor(private readonly sliders: SlidersService) {}

  @Get()
  @RequirePermission('slider:read')
  list(@Req() req: Request, @Query() query: ListSlidersDto) {
    return this.sliders.list(req.tenantId!, req.mallId, query);
  }

  @Patch('reorder')
  @RequirePermission('slider:reorder')
  reorder(
    @Body() dto: ReorderSlidersDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sliders.reorder(dto, user, req.tenantId!, req.mallId);
  }

  @Get(':id')
  @RequirePermission('slider:read')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.sliders.findOne(id, req.tenantId!);
  }

  @Post()
  @RequirePermission('slider:create')
  create(
    @Body() dto: CreateSliderDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sliders.create(dto, user, req.tenantId!, req.mallId);
  }

  @Patch(':id')
  @RequirePermission('slider:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSliderDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sliders.update(id, dto, user, req.tenantId!);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('slider:delete')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    await this.sliders.remove(id, user, req.tenantId!);
  }

  @Post(':id/publish')
  @RequirePermission('slider:publish')
  publish(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sliders.publish(id, user, req.tenantId!);
  }

  @Post(':id/archive')
  @RequirePermission('slider:update')
  archive(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sliders.archive(id, user, req.tenantId!);
  }

  @Get(':id/items')
  @RequirePermission('slider:read')
  listItems(@Param('id') id: string, @Req() req: Request) {
    return this.sliders.listItems(id, req.tenantId!);
  }

  @Post(':id/items')
  @RequirePermission('slider:update')
  createItem(
    @Param('id') id: string,
    @Body() dto: CreateSliderItemDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sliders.createItem(id, dto, user, req.tenantId!);
  }

  @Patch(':id/items/reorder')
  @RequirePermission('slider:reorder')
  reorderItems(
    @Param('id') id: string,
    @Body() dto: ReorderSliderItemsDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sliders.reorderItems(id, dto, user, req.tenantId!);
  }

  @Patch(':id/items/:itemId')
  @RequirePermission('slider:update')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateSliderItemDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sliders.updateItem(id, itemId, dto, user, req.tenantId!);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(204)
  @RequirePermission('slider:update')
  async removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    await this.sliders.removeItem(id, itemId, user, req.tenantId!);
  }
}
