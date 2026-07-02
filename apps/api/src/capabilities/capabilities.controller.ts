import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { CapabilitiesService } from './capabilities.service';
import { UpdateTenantCapabilitiesDto } from './dto/update-tenant-capabilities.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.CAPABILITIES)
@Controller()
export class CapabilitiesController {
  constructor(private readonly capabilities: CapabilitiesService) {}

  @Get('capabilities')
  @UseGuards(PermissionsGuard)
  @RequirePermission('capability:read')
  @ApiAdminContext()
  @ApiAdminOperation({ summary: 'capability.list.summary',
    description: 'Returns the global capability catalog with keys and descriptions.',
    permissions: ['capability:read'],
    related: [SWAGGER_TAGS.SETTINGS],
  })
  @ApiResponse({ status: 200, description: 'capability.response.200' })
  listAll() {
    return this.capabilities.listAll();
  }

  @Get('tenants/:tenantId/capabilities')
  @UseGuards(PermissionsGuard)
  @RequirePermission('capability:read')
  @ApiAdminContext()
  @ApiAdminOperation({ summary: 'capability.list.summary',
    description: 'Returns enabled/disabled capabilities for a specific tenant.',
    permissions: ['capability:read'],
    related: [SWAGGER_TAGS.TENANTS],
  })
  @ApiUuidParam('tenantId', 'common.param.uuid')
  @ApiResponse({ status: 200, description: 'capability.response.200' })
  listForTenant(@CurrentUser() user: User, @Param('tenantId') tenantId: string) {
    return this.capabilities.listForTenant(user, tenantId);
  }

  @Patch('tenants/:tenantId/capabilities')
  @UseGuards(PermissionsGuard)
  @RequirePermission('capability:update')
  @ApiAdminContext()
  @ApiAdminOperation({ summary: 'capability.update.summary',
    description: 'Enables or disables feature capabilities for a tenant (analytics, search, notifications, etc.).',
    permissions: ['capability:update'],
    related: [SWAGGER_TAGS.TENANTS, SWAGGER_TAGS.SETTINGS],
  })
  @ApiUuidParam('tenantId', 'common.param.uuid')
  @ApiResponse({ status: 200, description: 'capability.response.200' })
  update(
    @CurrentUser() user: User,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantCapabilitiesDto,
  ) {
    return this.capabilities.updateTenantCapabilities(user, tenantId, dto);
  }
}
