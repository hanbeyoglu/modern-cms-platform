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
import { ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.SLIDERS)
@ApiAdminContext()
@Controller('sliders')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class SlidersController {
  constructor(private readonly sliders: SlidersService) {}

  @Get()
  @RequirePermission('slider:read')
  @ApiAdminOperation({ summary: 'slider.list.summary',
    permissions: ['slider:read'],
    related: [SWAGGER_TAGS.MEDIA, SWAGGER_TAGS.CAMPAIGNS],
  })
  @ApiResponse({ status: 200, description: 'slider.response.200' })
  list(@Req() req: Request, @Query() query: ListSlidersDto) {
    return this.sliders.list(req.tenantId!, req.mallId, query);
  }

  @Patch('reorder')
  @RequirePermission('slider:reorder')
  @ApiAdminOperation({ summary: 'slider.reorder.summary', permissions: ['slider:reorder'] })
  @ApiResponse({ status: 200, description: 'slider.response.200' })
  reorder(
    @Body() dto: ReorderSlidersDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sliders.reorder(dto, user, req.tenantId!, req.mallId);
  }

  @Get(':id')
  @RequirePermission('slider:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'slider.get.summary',
    permissions: ['slider:read'],
    related: [SWAGGER_TAGS.MEDIA],
  })
  @ApiResponse({ status: 200, description: 'slider.response.200' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.sliders.findOne(id, req.tenantId!);
  }

  @Post()
  @RequirePermission('slider:create')
  @ApiAdminOperation({ summary: 'slider.create.summary',
    permissions: ['slider:create'],
    related: [SWAGGER_TAGS.MEDIA, SWAGGER_TAGS.CAMPAIGNS],
  })
  @ApiResponse({ status: 201, description: 'slider.response.201' })
  create(
    @Body() dto: CreateSliderDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sliders.create(dto, user, req.tenantId!, req.mallId);
  }

  @Patch(':id')
  @RequirePermission('slider:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'slider.update.summary', permissions: ['slider:update'] })
  @ApiResponse({ status: 200, description: 'slider.response.200' })
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
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'slider.delete.summary', permissions: ['slider:delete'] })
  @ApiResponse({ status: 204, description: 'slider.response.204' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    await this.sliders.remove(id, user, req.tenantId!);
  }

  @Post(':id/publish')
  @RequirePermission('slider:publish')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'slider.publish.summary',
    permissions: ['slider:publish'],
    related: [SWAGGER_TAGS.PUBLIC],
  })
  @ApiResponse({ status: 200, description: 'slider.response.200' })
  publish(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sliders.publish(id, user, req.tenantId!);
  }

  @Post(':id/archive')
  @RequirePermission('slider:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'slider.archive.summary', permissions: ['slider:update'] })
  @ApiResponse({ status: 200, description: 'slider.response.200' })
  archive(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sliders.archive(id, user, req.tenantId!);
  }

  @Get(':id/items')
  @RequirePermission('slider:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'slider.list.summary',
    permissions: ['slider:read'],
    related: [SWAGGER_TAGS.MEDIA],
  })
  @ApiResponse({ status: 200, description: 'slider.response.200' })
  listItems(@Param('id') id: string, @Req() req: Request) {
    return this.sliders.listItems(id, req.tenantId!);
  }

  @Post(':id/items')
  @RequirePermission('slider:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'slider.create.summary',
    permissions: ['slider:update'],
    related: [SWAGGER_TAGS.MEDIA, SWAGGER_TAGS.CAMPAIGNS],
  })
  @ApiResponse({ status: 201, description: 'slider.response.201' })
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
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'slider.reorder.summary', permissions: ['slider:reorder'] })
  @ApiResponse({ status: 200, description: 'slider.response.200' })
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
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiUuidParam('itemId', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'slider.update.summary', permissions: ['slider:update'] })
  @ApiResponse({ status: 200, description: 'slider.response.200' })
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
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiUuidParam('itemId', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'slider.delete.summary', permissions: ['slider:update'] })
  @ApiResponse({ status: 204, description: 'slider.response.204' })
  async removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    await this.sliders.removeItem(id, itemId, user, req.tenantId!);
  }
}
