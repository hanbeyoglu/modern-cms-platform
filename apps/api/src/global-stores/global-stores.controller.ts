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
import { GlobalStoresService } from './global-stores.service';
import { CreateGlobalStoreDto } from './dto/create-global-store.dto';
import { UpdateGlobalStoreDto } from './dto/update-global-store.dto';
import { ListGlobalStoresDto } from './dto/list-global-stores.dto';

@Controller('global-stores')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard)
export class GlobalStoresController {
  constructor(private readonly globalStores: GlobalStoresService) {}

  @Get()
  @RequirePermission('global-store:read')
  list(@Query() query: ListGlobalStoresDto) {
    return this.globalStores.list(query);
  }

  @Get(':id')
  @RequirePermission('global-store:read')
  findOne(@Param('id') id: string) {
    return this.globalStores.findOne(id);
  }

  @Post()
  @RequirePermission('global-store:create')
  create(@Body() dto: CreateGlobalStoreDto, @CurrentUser() user: User) {
    return this.globalStores.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('global-store:update')
  update(@Param('id') id: string, @Body() dto: UpdateGlobalStoreDto, @CurrentUser() user: User) {
    return this.globalStores.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('global-store:delete')
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.globalStores.remove(id, user);
  }
}
