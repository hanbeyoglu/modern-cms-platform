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
import { CinemasService } from './cinemas.service';
import { CreateCinemaDto } from './dto/create-cinema.dto';
import { UpdateCinemaDto } from './dto/update-cinema.dto';
import { ListCinemasDto } from './dto/list-cinemas.dto';

@Controller('cinemas')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class CinemasController {
  constructor(private readonly cinemas: CinemasService) {}

  @Get()
  @RequirePermission('cinema:read')
  list(@Req() req: Request, @Query() query: ListCinemasDto) {
    return this.cinemas.list(req.tenantId!, req.mallId!, query);
  }

  @Get(':id')
  @RequirePermission('cinema:read')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.cinemas.findOne(id, req.tenantId!, req.mallId!);
  }

  @Post()
  @RequirePermission('cinema:create')
  create(@Body() dto: CreateCinemaDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.cinemas.create(dto, user, req.tenantId!, req.mallId!);
  }

  @Patch(':id')
  @RequirePermission('cinema:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCinemaDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.cinemas.update(id, dto, user, req.tenantId!, req.mallId!);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('cinema:delete')
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.cinemas.remove(id, user, req.tenantId!, req.mallId!);
  }
}
