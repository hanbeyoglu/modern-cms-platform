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
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { ListPagesDto } from './dto/list-pages.dto';

@Controller('pages')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @RequirePermission('page:read')
  list(@Req() req: Request, @Query() query: ListPagesDto) {
    return this.pages.list(req.tenantId!, req.mallId, query);
  }

  @Get(':id')
  @RequirePermission('page:read')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.pages.findOne(id, req.tenantId!, req.mallId);
  }

  @Post()
  @RequirePermission('page:create')
  create(@Body() dto: CreatePageDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.pages.create(dto, user, req.tenantId!, req.mallId);
  }

  @Patch(':id')
  @RequirePermission('page:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.pages.update(id, dto, user, req.tenantId!, req.mallId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('page:delete')
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.pages.remove(id, user, req.tenantId!, req.mallId);
  }

  @Post(':id/publish')
  @RequirePermission('page:publish')
  publish(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.pages.publish(id, user, req.tenantId!, req.mallId);
  }

  @Post(':id/archive')
  @RequirePermission('page:archive')
  archive(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.pages.archive(id, user, req.tenantId!, req.mallId);
  }
}
