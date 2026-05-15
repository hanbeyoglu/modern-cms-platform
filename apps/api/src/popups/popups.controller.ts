import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { RequireMallContext } from '../common/decorators/require-mall.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { PopupsService } from './popups.service';
import { CreatePopupDto } from './dto/create-popup.dto';
import { UpdatePopupDto } from './dto/update-popup.dto';
import { ListPopupsDto } from './dto/list-popups.dto';

@Controller('popups')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class PopupsController {
  constructor(private readonly popups: PopupsService) {}

  @Get()
  @RequirePermission('popup:read')
  list(@Req() req: Request, @Query() query: ListPopupsDto) {
    return this.popups.list(req.tenantId!, req.mallId, query);
  }

  @Get(':id')
  @RequirePermission('popup:read')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.popups.findOne(id, req.tenantId!);
  }

  @Post()
  @RequirePermission('popup:create')
  create(@Body() dto: CreatePopupDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.popups.create(dto, user, req.tenantId!, req.mallId);
  }

  @Patch(':id')
  @RequirePermission('popup:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePopupDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.popups.update(id, dto, user, req.tenantId!);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('popup:delete')
  remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.popups.remove(id, user, req.tenantId!);
  }

  @Post(':id/publish')
  @RequirePermission('popup:publish')
  publish(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.popups.publish(id, user, req.tenantId!);
  }

  @Post(':id/archive')
  @RequirePermission('popup:publish')
  archive(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.popups.archive(id, user, req.tenantId!);
  }
}
