import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

/**
 * Global stores are platform-level brand master data (Option A ownership model).
 * Read access: any role with global-store:read in tenant context.
 * Write access: Super Admin only (permission check + isSuperAdmin guard).
 */
@ApiTags(SWAGGER_TAGS.GLOBAL_STORES)
@ApiAdminContext()
@Controller('global-stores')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard)
export class GlobalStoresController {
  constructor(private readonly globalStores: GlobalStoresService) {}

  @Get()
  @RequirePermission('global-store:read')
  @ApiAdminOperation({ summary: 'globalStore.list.summary',
    permissions: ['global-store:read'],
    related: [SWAGGER_TAGS.STORES, SWAGGER_TAGS.STORE_CATEGORIES],
  })
  @ApiResponse({ status: 200, description: 'globalStore.response.200' })
  list(@Query() query: ListGlobalStoresDto) {
    return this.globalStores.list(query);
  }

  @Get(':id')
  @RequirePermission('global-store:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'globalStore.get.summary',
    permissions: ['global-store:read'],
    related: [SWAGGER_TAGS.STORES],
  })
  @ApiResponse({ status: 200, description: 'globalStore.response.200' })
  findOne(@Param('id') id: string) {
    return this.globalStores.findOne(id);
  }

  @Post()
  @RequirePermission('global-store:create')
  @ApiAdminOperation({ summary: 'globalStore.create.summary',
    permissions: ['global-store:create'],
    related: [SWAGGER_TAGS.STORE_CATEGORIES],
  })
  @ApiResponse({ status: 201, description: 'globalStore.response.201' })
  create(@Body() dto: CreateGlobalStoreDto, @CurrentUser() user: User) {
    if (!user.isSuperAdmin) {
      throw new ForbiddenException('Global mağaza yalnızca Super Admin tarafından oluşturulabilir');
    }
    return this.globalStores.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('global-store:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'globalStore.update.summary', permissions: ['global-store:update'] })
  @ApiResponse({ status: 200, description: 'globalStore.response.200' })
  update(@Param('id') id: string, @Body() dto: UpdateGlobalStoreDto, @CurrentUser() user: User) {
    if (!user.isSuperAdmin) {
      throw new ForbiddenException('Global mağaza yalnızca Super Admin tarafından güncellenebilir');
    }
    return this.globalStores.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('global-store:delete')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'globalStore.delete.summary', permissions: ['global-store:delete'] })
  @ApiResponse({ status: 204, description: 'globalStore.response.204' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    if (!user.isSuperAdmin) {
      throw new ForbiddenException('Global mağaza yalnızca Super Admin tarafından silinebilir');
    }
    await this.globalStores.remove(id, user);
  }
}
