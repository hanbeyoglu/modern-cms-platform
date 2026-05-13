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
import { MallStoresService } from './mall-stores.service';
import { AssignMallStoreDto } from './dto/assign-mall-store.dto';
import { UpdateMallStoreDto } from './dto/update-mall-store.dto';
import { ListMallStoresDto } from './dto/list-mall-stores.dto';

@Controller('mall-stores')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class MallStoresController {
  constructor(private readonly mallStores: MallStoresService) {}

  @Get()
  @RequirePermission('mall-store:read')
  list(@Req() req: Request, @CurrentUser() user: User, @Query() query: ListMallStoresDto) {
    return this.mallStores.list(req, user, query);
  }

  @Post('assign')
  @RequirePermission('mall-store:assign')
  assign(@Req() req: Request, @CurrentUser() user: User, @Body() dto: AssignMallStoreDto) {
    return this.mallStores.assign(req, user, dto);
  }

  @Get(':id')
  @RequirePermission('mall-store:read')
  findOne(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    return this.mallStores.findOne(req, user, id);
  }

  @Patch(':id')
  @RequirePermission('mall-store:update')
  update(
    @Req() req: Request,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateMallStoreDto,
  ) {
    return this.mallStores.update(req, user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('mall-store:delete')
  async remove(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    await this.mallStores.remove(req, user, id);
  }

  @Post(':id/feature')
  @RequirePermission('mall-store:feature')
  feature(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    return this.mallStores.setFeatured(req, user, id, true);
  }

  @Post(':id/unfeature')
  @RequirePermission('mall-store:feature')
  unfeature(@Req() req: Request, @CurrentUser() user: User, @Param('id') id: string) {
    return this.mallStores.setFeatured(req, user, id, false);
  }
}
