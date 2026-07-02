import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../common/decorators/require-any-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { MallFloorsService } from './mall-floors.service';
import { CreateMallFloorDto } from './dto/create-mall-floor.dto';
import { UpdateMallFloorDto } from './dto/update-mall-floor.dto';
import { ReorderMallFloorsDto } from './dto/reorder-mall-floors.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.MALLS)
@ApiAdminContext()
@Controller('mall-floors')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class MallFloorsController {
  constructor(private readonly floors: MallFloorsService) {}

  @Get()
  @RequireAnyPermission('location:read', 'mall-store:read', 'mall-store:update')
  @ApiAdminOperation({
    summary: 'mallFloor.list.summary',
    permissions: ['location:read', 'mall-store:read', 'mall-store:update'],
  })
  @ApiResponse({ status: 200, description: 'mallFloor.response.200' })
  list(@Req() req: Request, @CurrentUser() user: User) {
    return this.floors.list(req, user);
  }

  @Post()
  @RequireAnyPermission('location:update', 'mall-store:update')
  @ApiAdminOperation({
    summary: 'mallFloor.create.summary',
    permissions: ['location:update', 'mall-store:update'],
  })
  @ApiResponse({ status: 201, description: 'mallFloor.response.201' })
  create(@Req() req: Request, @CurrentUser() user: User, @Body() dto: CreateMallFloorDto) {
    return this.floors.create(req, user, dto);
  }

  @Patch('reorder')
  @RequireAnyPermission('location:update', 'mall-store:update')
  @ApiAdminOperation({
    summary: 'mallFloor.reorder.summary',
    permissions: ['location:update', 'mall-store:update'],
  })
  @ApiResponse({ status: 200, description: 'mallFloor.response.200' })
  reorder(@Req() req: Request, @CurrentUser() user: User, @Body() dto: ReorderMallFloorsDto) {
    return this.floors.reorder(req, user, dto.orderedIds);
  }

  @Patch(':id')
  @RequireAnyPermission('location:update', 'mall-store:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'mallFloor.update.summary',
    permissions: ['location:update', 'mall-store:update'],
  })
  @ApiResponse({ status: 200, description: 'mallFloor.response.200' })
  update(
    @Req() req: Request,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateMallFloorDto,
  ) {
    return this.floors.update(req, user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireAnyPermission('location:update', 'mall-store:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'mallFloor.delete.summary',
    permissions: ['location:update', 'mall-store:update'],
  })
  @ApiResponse({ status: 204, description: 'mallFloor.response.204' })
  async remove(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    await this.floors.remove(req, user, id);
  }
}
