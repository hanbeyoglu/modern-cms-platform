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
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { LocalesService } from './locales.service';
import { CreateLocaleDto } from './dto/create-locale.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';
import { ListLocalesDto } from './dto/list-locales.dto';

@Controller('locales')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard)
export class LocalesController {
  constructor(private readonly locales: LocalesService) {}

  @Get()
  @RequirePermission('locale:read')
  list(@Req() req: Request, @Query() query: ListLocalesDto) {
    return this.locales.list(req.tenantId!, query);
  }

  @Post()
  @RequirePermission('locale:create')
  create(@Body() dto: CreateLocaleDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.locales.create(dto, user, req.tenantId!);
  }

  @Patch(':id')
  @RequirePermission('locale:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLocaleDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.locales.update(id, dto, user, req.tenantId!);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('locale:delete')
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.locales.deactivate(id, user, req.tenantId!);
  }

  @Post(':id/default')
  @RequirePermission('locale:set-default')
  setDefault(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.locales.setDefault(id, user, req.tenantId!);
  }
}
