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
import { MallStoresService } from './mall-stores.service';
import { AssignMallStoreDto } from './dto/assign-mall-store.dto';
import { UpdateMallStoreDto } from './dto/update-mall-store.dto';
import { ListMallStoresDto } from './dto/list-mall-stores.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.STORES)
@ApiAdminContext()
@Controller('mall-stores')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class MallStoresController {
  constructor(private readonly mallStores: MallStoresService) {}

  @Get()
  @RequirePermission('mall-store:read')
  @ApiAdminOperation({ summary: 'mallStore.list.summary',
    permissions: ['mall-store:read'],
    related: [SWAGGER_TAGS.GLOBAL_STORES, SWAGGER_TAGS.CAMPAIGNS],
  })
  @ApiResponse({ status: 200, description: 'mallStore.response.200' })
  list(@Req() req: Request, @CurrentUser() user: User, @Query() query: ListMallStoresDto) {
    return this.mallStores.list(req, user, query);
  }

  @Post('assign')
  @RequirePermission('mall-store:assign')
  @ApiAdminOperation({ summary: 'mallStore.assign.global.store.to.mall.summary',
    permissions: ['mall-store:assign'],
    related: [SWAGGER_TAGS.GLOBAL_STORES],
  })
  @ApiResponse({ status: 201, description: 'mallStore.response.201' })
  assign(@Req() req: Request, @CurrentUser() user: User, @Body() dto: AssignMallStoreDto) {
    return this.mallStores.assign(req, user, dto);
  }

  @Get(':id')
  @RequirePermission('mall-store:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'mallStore.get.summary',
    permissions: ['mall-store:read'],
    related: [SWAGGER_TAGS.GLOBAL_STORES],
  })
  @ApiResponse({ status: 200, description: 'mallStore.response.200' })
  findOne(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    return this.mallStores.findOne(req, user, id);
  }

  @Patch(':id')
  @RequirePermission('mall-store:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'mallStore.update.summary', permissions: ['mall-store:update'] })
  @ApiResponse({ status: 200, description: 'mallStore.response.200' })
  update(
    @Req() req: Request,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateMallStoreDto,
  ) {
    return this.mallStores.update(req, user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('mall-store:delete')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'mallStore.delete.summary', permissions: ['mall-store:delete'] })
  @ApiResponse({ status: 204, description: 'mallStore.response.204' })
  async remove(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    await this.mallStores.remove(req, user, id);
  }

  @Post(':id/feature')
  @RequirePermission('mall-store:feature')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'mallStore.feature.mall.store.summary', permissions: ['mall-store:feature'] })
  @ApiResponse({ status: 200, description: 'mallStore.response.200' })
  feature(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    return this.mallStores.setFeatured(req, user, id, true);
  }

  @Post(':id/unfeature')
  @RequirePermission('mall-store:feature')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'mallStore.unfeature.mall.store.summary', permissions: ['mall-store:feature'] })
  @ApiResponse({ status: 200, description: 'mallStore.response.200' })
  unfeature(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    return this.mallStores.setFeatured(req, user, id, false);
  }
}
