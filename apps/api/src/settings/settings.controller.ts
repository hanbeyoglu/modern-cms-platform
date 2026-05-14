import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { SettingsService } from './settings.service';
import { UpdateGeneralSettingsDto, UpdateSecuritySettingsDto } from './dto/update-settings.dto';

@Controller('tenants/:tenantId/settings')
@UseGuards(PermissionsGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermission('settings:read')
  get(@CurrentUser() actor: User, @Param('tenantId') tenantId: string) {
    return this.settings.getSettings(actor, tenantId);
  }

  @Patch('general')
  @RequirePermission('settings:update')
  updateGeneral(
    @CurrentUser() actor: User,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateGeneralSettingsDto,
  ) {
    return this.settings.updateGeneralSettings(actor, tenantId, dto);
  }

  @Patch('security')
  @RequirePermission('settings:update')
  updateSecurity(
    @CurrentUser() actor: User,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateSecuritySettingsDto,
  ) {
    return this.settings.updateSecuritySettings(actor, tenantId, dto);
  }
}
