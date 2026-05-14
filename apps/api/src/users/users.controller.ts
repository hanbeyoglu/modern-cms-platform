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
import { UsersService } from './users.service';
import { ListUsersDto } from './dto/list-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserStatusDto } from './dto/update-user.dto';
import { CreateMembershipDto, UpdateMembershipDto } from './dto/membership.dto';

@Controller('users')
@UseGuards(PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('user:read')
  list(@CurrentUser() actor: User, @Query() query: ListUsersDto) {
    return this.users.list(actor, query);
  }

  @Get(':id')
  @RequirePermission('user:read')
  findOne(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.users.findOne(actor, id);
  }

  @Post()
  @RequirePermission('user:create')
  create(@CurrentUser() actor: User, @Body() dto: CreateUserDto) {
    return this.users.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermission('user:update')
  update(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(actor, id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('user:update')
  updateStatus(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.users.updateStatus(actor, id, dto);
  }

  @Post(':id/memberships')
  @RequirePermission('user:create')
  addMembership(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: CreateMembershipDto,
  ) {
    return this.users.addMembership(actor, id, dto);
  }

  @Patch(':id/memberships/:membershipId')
  @RequirePermission('user:update')
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
  removeMembership(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.users.removeMembership(actor, id, membershipId);
  }

  @Post(':id/reset-password')
  @RequirePermission('user:update')
  resetPassword(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.users.resetPassword(actor, id);
  }
}
