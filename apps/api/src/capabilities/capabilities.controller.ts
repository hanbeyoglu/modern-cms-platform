import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { CapabilitiesService } from './capabilities.service';
import { UpdateTenantCapabilitiesDto } from './dto/update-tenant-capabilities.dto';

@Controller()
export class CapabilitiesController {
  constructor(private readonly capabilities: CapabilitiesService) {}

  @Get('capabilities')
  @UseGuards(PermissionsGuard)
  @RequirePermission('capability:read')
  listAll() {
    return this.capabilities.listAll();
  }

  @Get('tenants/:tenantId/capabilities')
  @UseGuards(PermissionsGuard)
  @RequirePermission('capability:read')
  listForTenant(@CurrentUser() user: User, @Param('tenantId') tenantId: string) {
    return this.capabilities.listForTenant(user, tenantId);
  }

  @Patch('tenants/:tenantId/capabilities')
  @UseGuards(PermissionsGuard)
  @RequirePermission('capability:update')
  update(
    @CurrentUser() user: User,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantCapabilitiesDto,
  ) {
    return this.capabilities.updateTenantCapabilities(user, tenantId, dto);
  }
}
