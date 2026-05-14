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
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto, UpdateRolePermissionsDto, CloneRoleDto } from './dto/update-role.dto';

@Controller('roles')
@UseGuards(PermissionsGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission('role:read')
  list(@CurrentUser() actor: User, @Query('tenantId') tenantId?: string) {
    return this.roles.list(actor, tenantId);
  }

  @Get('permissions')
  @RequirePermission('role:read')
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Get(':id')
  @RequirePermission('role:read')
  findOne(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.roles.findOne(actor, id);
  }

  @Post()
  @RequirePermission('role:create')
  create(@CurrentUser() actor: User, @Body() dto: CreateRoleDto) {
    return this.roles.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermission('role:update')
  update(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(actor, id, dto);
  }

  @Patch(':id/permissions')
  @RequirePermission('role:update')
  updatePermissions(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.roles.updatePermissions(actor, id, dto);
  }

  @Post(':id/clone')
  @RequirePermission('role:create')
  clone(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: CloneRoleDto) {
    return this.roles.clone(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermission('role:delete')
  remove(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.roles.remove(actor, id);
  }
}
