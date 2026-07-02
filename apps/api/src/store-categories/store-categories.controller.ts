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
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../common/decorators/require-any-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { StoreCategoriesService } from './store-categories.service';
import { CreateStoreCategoryDto } from './dto/create-store-category.dto';
import { UpdateStoreCategoryDto } from './dto/update-store-category.dto';
import { ListStoreCategoriesDto } from './dto/list-store-categories.dto';
import { ReorderStoreCategoriesDto } from './dto/reorder-store-categories.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.STORE_CATEGORIES)
@ApiAdminContext()
@Controller('store-categories')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class StoreCategoriesController {
  constructor(private readonly storeCategories: StoreCategoriesService) {}

  @Get()
  @RequireAnyPermission('location:read', 'store-category:read', 'mall-store:read')
  @ApiAdminOperation({
    summary: 'storeCategory.list.summary',
    permissions: ['location:read', 'store-category:read', 'mall-store:read'],
    related: [SWAGGER_TAGS.STORES],
  })
  @ApiResponse({ status: 200, description: 'storeCategory.response.200' })
  list(@Req() req: Request, @CurrentUser() user: User, @Query() query: ListStoreCategoriesDto) {
    return this.storeCategories.list(req, user, query);
  }

  @Get(':id')
  @RequireAnyPermission('location:read', 'store-category:read', 'mall-store:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'storeCategory.get.summary',
    permissions: ['location:read', 'store-category:read', 'mall-store:read'],
  })
  findOne(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    return this.storeCategories.findOne(req, user, id);
  }

  @Post()
  @RequireAnyPermission('location:update', 'store-category:create')
  @ApiAdminOperation({
    summary: 'storeCategory.create.summary',
    permissions: ['location:update', 'store-category:create'],
  })
  @ApiResponse({ status: 201, description: 'storeCategory.response.201' })
  create(@Req() req: Request, @CurrentUser() user: User, @Body() dto: CreateStoreCategoryDto) {
    return this.storeCategories.create(req, user, dto);
  }

  @Patch('reorder')
  @RequireAnyPermission('location:update', 'store-category:update')
  @ApiAdminOperation({
    summary: 'storeCategory.reorder.summary',
    permissions: ['location:update', 'store-category:update'],
  })
  reorder(@Req() req: Request, @CurrentUser() user: User, @Body() dto: ReorderStoreCategoriesDto) {
    return this.storeCategories.reorder(req, user, dto.orderedIds);
  }

  @Patch(':id')
  @RequireAnyPermission('location:update', 'store-category:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'storeCategory.update.summary',
    permissions: ['location:update', 'store-category:update'],
  })
  update(
    @Req() req: Request,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateStoreCategoryDto,
  ) {
    return this.storeCategories.update(req, user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireAnyPermission('location:update', 'store-category:delete')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'storeCategory.delete.summary',
    permissions: ['location:update', 'store-category:delete'],
  })
  async remove(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    await this.storeCategories.remove(req, user, id);
  }
}
