import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { MallStatus, User } from '@prisma/client';
import type { Request } from 'express';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { MallsService } from './malls.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { ListLocationsDto } from './dto/list-locations.dto';

// ── Legacy /malls/* (unchanged behavior) ──────────────────────────────────────

@Controller('malls')
@RequireTenantContext()
@Permissions('mall:read')
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class MallsController {
  constructor(private readonly malls: MallsService) {}

  @Get('my')
  async my(@CurrentUser() user: User, @Req() req: Request) {
    return this.malls.my(user, req.tenantId);
  }
}

// ── /locations — full Location CRUD ──────────────────────────────────────────

@Controller('locations')
@UseGuards(PermissionsGuard)
export class LocationsController {
  constructor(private readonly malls: MallsService) {}

  @Get()
  @RequirePermission('location:read')
  list(@CurrentUser() actor: User, @Query() query: ListLocationsDto) {
    return this.malls.list(actor, query);
  }

  @Get(':id')
  @RequirePermission('location:read')
  findOne(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.malls.findOne(actor, id);
  }

  @Post()
  @RequirePermission('location:create')
  create(@CurrentUser() actor: User, @Body() dto: CreateLocationDto) {
    return this.malls.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermission('location:update')
  update(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.malls.update(actor, id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('location:update')
  updateStatus(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body('status') status: MallStatus,
  ) {
    return this.malls.updateStatus(actor, id, status);
  }

  @Delete(':id')
  @RequirePermission('location:delete')
  remove(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.malls.remove(actor, id);
  }
}
