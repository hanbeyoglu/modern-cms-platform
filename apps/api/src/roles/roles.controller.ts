import {
  Body,
  Controller,
  Delete,
  Get,
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
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto, UpdateRolePermissionsDto, CloneRoleDto } from './dto/update-role.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiAdminContext, ApiAdminOperation, ApiUuidParam } from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.ROLES)
@ApiAdminContext()
@Controller('roles')
@UseGuards(PermissionsGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission('role:read')
  @ApiAdminOperation({ summary: 'role.list.summary',
    permissions: ['role:read'],
    related: [SWAGGER_TAGS.PERMISSIONS, SWAGGER_TAGS.TENANTS],
  })
  @ApiResponse({ status: 200, description: 'role.response.200' })
  list(@CurrentUser() actor: User, @Query('tenantId') tenantId?: string) {
    return this.roles.list(actor, tenantId);
  }

  @Get('permissions')
  @RequirePermission('role:read')
  @ApiAdminOperation({ summary: 'role.list.summary',
    permissions: ['role:read'],
    related: [SWAGGER_TAGS.PERMISSIONS],
  })
  @ApiResponse({ status: 200, description: 'role.response.200' })
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Get(':id')
  @RequirePermission('role:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'role.get.summary',
    permissions: ['role:read'],
    related: [SWAGGER_TAGS.PERMISSIONS],
  })
  @ApiResponse({ status: 200, description: 'role.response.200' })
  findOne(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.roles.findOne(actor, id);
  }

  @Post()
  @RequirePermission('role:create')
  @ApiAdminOperation({ summary: 'role.create.summary',
    permissions: ['role:create'],
    related: [SWAGGER_TAGS.PERMISSIONS],
  })
  @ApiResponse({ status: 201, description: 'role.response.201' })
  create(@CurrentUser() actor: User, @Body() dto: CreateRoleDto) {
    return this.roles.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermission('role:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'role.update.summary', permissions: ['role:update'] })
  @ApiResponse({ status: 200, description: 'role.response.200' })
  update(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(actor, id, dto);
  }

  @Patch(':id/permissions')
  @RequirePermission('role:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'role.update.summary',
    permissions: ['role:update'],
    related: [SWAGGER_TAGS.PERMISSIONS],
  })
  @ApiResponse({ status: 200, description: 'role.response.200' })
  updatePermissions(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.roles.updatePermissions(actor, id, dto);
  }

  @Post(':id/clone')
  @RequirePermission('role:create')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'role.clone.summary', permissions: ['role:create'] })
  @ApiResponse({ status: 201, description: 'role.response.201' })
  clone(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: CloneRoleDto) {
    return this.roles.clone(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermission('role:delete')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'role.delete.summary', permissions: ['role:delete'] })
  @ApiResponse({ status: 200, description: 'role.response.200' })
  remove(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.roles.remove(actor, id);
  }
}
