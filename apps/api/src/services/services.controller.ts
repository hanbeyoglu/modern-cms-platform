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
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesDto } from './dto/list-services.dto';

@Controller('services')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @RequirePermission('service:read')
  list(@Req() req: Request, @Query() query: ListServicesDto) {
    return this.services.list(req.tenantId!, req.mallId!, query);
  }

  @Get(':id')
  @RequirePermission('service:read')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.services.findOne(id, req.tenantId!);
  }

  @Post()
  @RequirePermission('service:create')
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.services.create(dto, user, req.tenantId!, req.mallId!);
  }

  @Patch(':id')
  @RequirePermission('service:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.services.update(id, dto, user, req.tenantId!);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('service:delete')
  remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.services.remove(id, user, req.tenantId!);
  }
}
