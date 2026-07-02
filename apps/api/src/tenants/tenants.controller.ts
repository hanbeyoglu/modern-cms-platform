import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import type { TenantStatus, User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ListTenantsDto } from './dto/list-tenants.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiAdminContext, ApiAdminOperation, ApiUuidParam } from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.TENANTS)
@ApiAdminContext()
@Controller('tenants')
@UseGuards(PermissionsGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  // Legacy: returns tenants for current user (no permission guard needed)
  @Get('my')
  @ApiAdminOperation({ summary: 'tenant.list.summary',
    permissions: ['authenticated'],
    related: [SWAGGER_TAGS.USERS],
  })
  @ApiResponse({ status: 200, description: 'tenant.response.200' })
  my(@CurrentUser() user: User) {
    return this.tenants.my(user);
  }

  @Get()
  @RequirePermission('tenant:read')
  @ApiAdminOperation({ summary: 'tenant.list.summary',
    permissions: ['tenant:read'],
    related: [SWAGGER_TAGS.USERS, SWAGGER_TAGS.SETTINGS],
  })
  @ApiResponse({ status: 200, description: 'tenant.response.200' })
  list(@CurrentUser() actor: User, @Query() query: ListTenantsDto) {
    return this.tenants.list(actor, query);
  }

  @Get(':id')
  @RequirePermission('tenant:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'tenant.get.summary',
    permissions: ['tenant:read'],
    related: [SWAGGER_TAGS.SETTINGS],
  })
  @ApiResponse({ status: 200, description: 'tenant.response.200' })
  findOne(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.tenants.findOne(actor, id);
  }

  @Post()
  @RequirePermission('tenant:create')
  @ApiAdminOperation({ summary: 'tenant.create.summary', permissions: ['tenant:create'] })
  @ApiResponse({ status: 201, description: 'tenant.response.201' })
  create(@CurrentUser() actor: User, @Body() dto: CreateTenantDto) {
    return this.tenants.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermission('tenant:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'tenant.update.summary', permissions: ['tenant:update'] })
  @ApiResponse({ status: 200, description: 'tenant.response.200' })
  update(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(actor, id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('tenant:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'tenant.update.summary', permissions: ['tenant:update'] })
  @ApiResponse({ status: 200, description: 'tenant.response.200' })
  updateStatus(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body('status') status: TenantStatus,
  ) {
    return this.tenants.updateStatus(actor, id, status);
  }
}
