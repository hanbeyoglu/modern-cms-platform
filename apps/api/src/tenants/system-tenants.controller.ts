import { Body, Controller, Delete, Get, HttpCode, Param, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { TenantsService } from './tenants.service';
import { DeleteTenantDto } from './dto/delete-tenant.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiAdminContext, ApiAdminOperation, ApiUuidParam } from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.SYSTEM_TENANTS)
@ApiAdminContext()
@Controller('system/tenants')
@UseGuards(PermissionsGuard)
export class SystemTenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get(':id/delete-preview')
  @RequirePermission('tenant:delete')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'tenant.deletePreview.summary',
    description: 'tenant.deletePreview.description',
    permissions: ['tenant:delete'],
  })
  @ApiResponse({ status: 200, description: 'tenant.deletePreview.response.200' })
  deletePreview(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.tenants.deletePreview(actor, id);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission('tenant:delete')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'tenant.delete.summary',
    description: 'tenant.delete.description',
    permissions: ['tenant:delete'],
  })
  @ApiResponse({ status: 200, description: 'tenant.delete.response.200' })
  delete(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: DeleteTenantDto,
  ) {
    return this.tenants.delete(actor, id, dto);
  }
}
