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
import type { TenantStatus, User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ListTenantsDto } from './dto/list-tenants.dto';

@Controller('tenants')
@UseGuards(PermissionsGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  // Legacy: returns tenants for current user (no permission guard needed)
  @Get('my')
  my(@CurrentUser() user: User) {
    return this.tenants.my(user);
  }

  @Get()
  @RequirePermission('tenant:read')
  list(@CurrentUser() actor: User, @Query() query: ListTenantsDto) {
    return this.tenants.list(actor, query);
  }

  @Get(':id')
  @RequirePermission('tenant:read')
  findOne(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.tenants.findOne(actor, id);
  }

  @Post()
  @RequirePermission('tenant:create')
  create(@CurrentUser() actor: User, @Body() dto: CreateTenantDto) {
    return this.tenants.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermission('tenant:update')
  update(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(actor, id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('tenant:update')
  updateStatus(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body('status') status: TenantStatus,
  ) {
    return this.tenants.updateStatus(actor, id, status);
  }
}
