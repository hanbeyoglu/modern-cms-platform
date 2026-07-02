import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { RequireMallContext } from '../common/decorators/require-mall.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { ApiAdminContext, ApiAdminOperation, ApiUuidParam } from '../swagger/swagger.decorators';
import { ScreeningHallsService } from './screening-halls.service';
import { ListScreeningHallsDto } from './dto/list-screening-halls.dto';
import { CreateScreeningHallDto } from './dto/create-screening-hall.dto';

@ApiTags('Screening Halls')
@ApiAdminContext()
@Controller('screening-halls')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class ScreeningHallsController {
  constructor(private readonly halls: ScreeningHallsService) {}

  @Get()
  @RequirePermission('movie:read')
  @ApiAdminOperation({ summary: 'List screening halls', permissions: ['movie:read'] })
  @ApiResponse({ status: 200, description: 'List of screening halls' })
  list(@Req() req: Request, @Query() query: ListScreeningHallsDto) {
    return this.halls.list(req.tenantId!, req.mallId!, query);
  }

  @Post()
  @RequirePermission('movie:update')
  @ApiAdminOperation({ summary: 'Create screening hall', permissions: ['movie:update'] })
  @ApiResponse({ status: 201, description: 'Created screening hall' })
  create(@Body() dto: CreateScreeningHallDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.halls.create(dto, user, req.tenantId!, req.mallId!);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('movie:update')
  @ApiUuidParam('id', 'Screening Hall ID')
  @ApiAdminOperation({ summary: 'Delete screening hall', permissions: ['movie:update'] })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.halls.remove(id, user, req.tenantId!, req.mallId!);
  }
}
