import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import type { MallStatus, User } from '@prisma/client';
import type { Request } from 'express';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { MallsService } from './malls.service';
import { MallLocalesService } from '../mall-locales/mall-locales.service';
import { UpdateLocationLocalesDto } from '../mall-locales/dto/update-location-locales.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { ListLocationsDto } from './dto/list-locations.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

// ── Legacy /malls/* (unchanged behavior) ──────────────────────────────────────

/** Context hydration only — tenant membership, not mall:read / location admin perms. */
@ApiTags(SWAGGER_TAGS.MALLS)
@ApiAdminContext()
@Controller('malls')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, MallAccessGuard)
export class MallsController {
  constructor(private readonly malls: MallsService) {}

  @Get('my')
  @ApiAdminOperation({ summary: 'mall.list.summary',
    description: 'Returns malls the authenticated user can access within the current tenant.',
    related: [SWAGGER_TAGS.STORES, SWAGGER_TAGS.CAMPAIGNS],
  })
  @ApiResponse({ status: 200, description: 'mall.response.200' })
  async my(@CurrentUser() user: User, @Req() req: Request) {
    return this.malls.my(user, req.tenantId);
  }
}

// ── /locations — full Location CRUD ──────────────────────────────────────────

@ApiTags(SWAGGER_TAGS.MALLS)
@ApiAdminContext()
@Controller('locations')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard)
export class LocationsController {
  constructor(
    private readonly malls: MallsService,
    private readonly mallLocales: MallLocalesService,
  ) {}

  @Get()
  @RequirePermission('location:read')
  @ApiAdminOperation({ summary: 'mall.list.summary',
    permissions: ['location:read'],
    related: [SWAGGER_TAGS.STORES, SWAGGER_TAGS.CAMPAIGNS],
  })
  @ApiResponse({ status: 200, description: 'mall.response.200' })
  list(@CurrentUser() actor: User, @Query() query: ListLocationsDto) {
    return this.malls.list(actor, query);
  }

  @Get(':id/locales/active')
  @RequirePermission('location:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'mall.locales.active.summary',
    description: 'mall.locales.active.deprecated',
    permissions: ['location:read'],
    related: [SWAGGER_TAGS.SYSTEM_LOCALES],
    deprecated: true,
  })
  @ApiResponse({ status: 200, description: 'mall.response.200' })
  activeLocales(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.mallLocales.getActiveLocalesForMall(req.tenantId!, id);
  }

  @Get(':id/locales')
  @RequirePermission('location:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'mall.locales.list.summary',
    description: 'mall.locales.list.description',
    permissions: ['location:read'],
    related: [SWAGGER_TAGS.SYSTEM_LOCALES],
  })
  @ApiResponse({ status: 200, description: 'mall.response.200' })
  listLocales(@Param('id') id: string, @Req() req: Request) {
    return this.mallLocales.listForLocation(req.tenantId!, id);
  }

  @Patch(':id/locales')
  @RequirePermission('location:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'mall.locales.update.summary',
    permissions: ['location:update'],
    related: [SWAGGER_TAGS.LOCALES],
  })
  @ApiResponse({ status: 200, description: 'mall.response.200' })
  updateLocales(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: UpdateLocationLocalesDto,
    @Req() req: Request,
  ) {
    return this.mallLocales.updateForLocation(req.tenantId!, id, dto, actor);
  }

  @Get(':id')
  @RequirePermission('location:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'mall.get.summary',
    permissions: ['location:read'],
  })
  @ApiResponse({ status: 200, description: 'mall.response.200' })
  findOne(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.malls.findOne(actor, id);
  }

  @Post()
  @RequirePermission('location:create')
  @ApiAdminOperation({ summary: 'mall.create.summary',
    permissions: ['location:create'],
  })
  @ApiResponse({ status: 201, description: 'mall.response.201' })
  create(@CurrentUser() actor: User, @Body() dto: CreateLocationDto) {
    return this.malls.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermission('location:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'mall.update.summary', permissions: ['location:update'] })
  @ApiResponse({ status: 200, description: 'mall.response.200' })
  update(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.malls.update(actor, id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('location:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'mall.update.summary', permissions: ['location:update'] })
  @ApiResponse({ status: 200, description: 'mall.response.200' })
  updateStatus(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body('status') status: MallStatus,
  ) {
    return this.malls.updateStatus(actor, id, status);
  }

  @Delete(':id')
  @RequirePermission('location:delete')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'mall.delete.summary', permissions: ['location:delete'] })
  @ApiResponse({ status: 200, description: 'mall.response.200' })
  remove(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.malls.remove(actor, id);
  }
}
