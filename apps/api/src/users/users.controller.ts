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
import { UsersService } from './users.service';
import { ListUsersDto } from './dto/list-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserStatusDto } from './dto/update-user.dto';
import { CreateMembershipDto, UpdateMembershipDto } from './dto/membership.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiAdminContext, ApiAdminOperation, ApiUuidParam } from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.USERS)
@ApiAdminContext()
@Controller('users')
@UseGuards(PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('user:read')
  @ApiAdminOperation({ summary: 'user.list.summary',
    permissions: ['user:read'],
    related: [SWAGGER_TAGS.ROLES, SWAGGER_TAGS.TENANTS],
  })
  @ApiResponse({ status: 200, description: 'user.response.200' })
  list(@CurrentUser() actor: User, @Query() query: ListUsersDto) {
    return this.users.list(actor, query);
  }

  @Get(':id')
  @RequirePermission('user:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'user.get.summary',
    permissions: ['user:read'],
    related: [SWAGGER_TAGS.ROLES],
  })
  @ApiResponse({ status: 200, description: 'user.response.200' })
  findOne(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.users.findOne(actor, id);
  }

  @Post()
  @RequirePermission('user:create')
  @ApiAdminOperation({ summary: 'user.create.summary',
    permissions: ['user:create'],
    related: [SWAGGER_TAGS.ROLES, SWAGGER_TAGS.TENANTS],
  })
  @ApiResponse({ status: 201, description: 'user.response.201' })
  create(@CurrentUser() actor: User, @Body() dto: CreateUserDto) {
    return this.users.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermission('user:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'user.update.summary', permissions: ['user:update'] })
  @ApiResponse({ status: 200, description: 'user.response.200' })
  update(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(actor, id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('user:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'user.update.summary', permissions: ['user:update'] })
  @ApiResponse({ status: 200, description: 'user.response.200' })
  updateStatus(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.users.updateStatus(actor, id, dto);
  }

  @Post(':id/memberships')
  @RequirePermission('user:create')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'user.add.tenant.membership.summary',
    permissions: ['user:create'],
    related: [SWAGGER_TAGS.ROLES, SWAGGER_TAGS.TENANTS],
  })
  @ApiResponse({ status: 201, description: 'user.response.201' })
  addMembership(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: CreateMembershipDto,
  ) {
    return this.users.addMembership(actor, id, dto);
  }

  @Patch(':id/memberships/:membershipId')
  @RequirePermission('user:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiUuidParam('membershipId', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'user.update.summary',
    permissions: ['user:update'],
    related: [SWAGGER_TAGS.ROLES],
  })
  @ApiResponse({ status: 200, description: 'user.response.200' })
  updateMembership(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.users.updateMembership(actor, id, membershipId, dto);
  }

  @Delete(':id/memberships/:membershipId')
  @RequirePermission('user:delete')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiUuidParam('membershipId', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'user.remove.tenant.membership.summary', permissions: ['user:delete'] })
  @ApiResponse({ status: 200, description: 'user.response.200' })
  removeMembership(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.users.removeMembership(actor, id, membershipId);
  }

  @Post(':id/reset-password')
  @RequirePermission('user:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'user.reset.user.password.summary', permissions: ['user:update'] })
  @ApiResponse({ status: 200, description: 'user.response.200' })
  resetPassword(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.users.resetPassword(actor, id);
  }
}
