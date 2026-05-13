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
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { StoreCategoriesService } from './store-categories.service';
import { CreateStoreCategoryDto } from './dto/create-store-category.dto';
import { UpdateStoreCategoryDto } from './dto/update-store-category.dto';
import { ListStoreCategoriesDto } from './dto/list-store-categories.dto';

@Controller('store-categories')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard)
export class StoreCategoriesController {
  constructor(private readonly storeCategories: StoreCategoriesService) {}

  @Get()
  @RequirePermission('store-category:read')
  list(@Query() query: ListStoreCategoriesDto) {
    return this.storeCategories.list(query);
  }

  @Post()
  @RequirePermission('store-category:create')
  create(@Body() dto: CreateStoreCategoryDto, @CurrentUser() user: User) {
    return this.storeCategories.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('store-category:update')
  update(@Param('id') id: string, @Body() dto: UpdateStoreCategoryDto, @CurrentUser() user: User) {
    return this.storeCategories.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('store-category:delete')
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.storeCategories.remove(id, user);
  }
}
