import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { SettingsService } from './settings.service';
import { UpdateGeneralSettingsDto, UpdateSecuritySettingsDto } from './dto/update-settings.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiAdminContext, ApiAdminOperation, ApiUuidParam } from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.SETTINGS)
@ApiAdminContext()
@Controller('tenants/:tenantId/settings')
@UseGuards(PermissionsGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermission('settings:read')
  @ApiUuidParam('tenantId', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'settings.get.summary',
    permissions: ['settings:read'],
    related: [SWAGGER_TAGS.TENANTS],
  })
  @ApiResponse({ status: 200, description: 'settings.response.200' })
  get(@CurrentUser() actor: User, @Param('tenantId') tenantId: string) {
    return this.settings.getSettings(actor, tenantId);
  }

  @Patch('general')
  @RequirePermission('settings:update')
  @ApiUuidParam('tenantId', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'settings.update.summary', permissions: ['settings:update'] })
  @ApiResponse({ status: 200, description: 'settings.response.200' })
  updateGeneral(
    @CurrentUser() actor: User,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateGeneralSettingsDto,
  ) {
    return this.settings.updateGeneralSettings(actor, tenantId, dto);
  }

  @Patch('security')
  @RequirePermission('settings:update')
  @ApiUuidParam('tenantId', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'settings.update.summary', permissions: ['settings:update'] })
  @ApiResponse({ status: 200, description: 'settings.response.200' })
  updateSecurity(
    @CurrentUser() actor: User,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateSecuritySettingsDto,
  ) {
    return this.settings.updateSecuritySettings(actor, tenantId, dto);
  }
}
