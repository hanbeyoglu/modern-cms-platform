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
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ListServicesDto } from './dto/list-services.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.SERVICES)
@ApiAdminContext()
@Controller('services')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @RequirePermission('service:read')
  @ApiAdminOperation({ summary: 'service.list.summary',
    permissions: ['service:read'],
    related: [SWAGGER_TAGS.MALLS],
  })
  @ApiResponse({ status: 200, description: 'service.response.200' })
  list(@Req() req: Request, @Query() query: ListServicesDto) {
    return this.services.list(req.tenantId!, req.mallId!, query);
  }

  @Get(':id')
  @RequirePermission('service:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'service.get.summary',
    permissions: ['service:read'],
  })
  @ApiResponse({ status: 200, description: 'service.response.200' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.services.findOne(id, req.tenantId!);
  }

  @Post()
  @RequirePermission('service:create')
  @ApiAdminOperation({ summary: 'service.create.summary',
    permissions: ['service:create'],
  })
  @ApiResponse({ status: 201, description: 'service.response.201' })
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.services.create(dto, user, req.tenantId!, req.mallId!);
  }

  @Patch(':id')
  @RequirePermission('service:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'service.update.summary', permissions: ['service:update'] })
  @ApiResponse({ status: 200, description: 'service.response.200' })
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
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'service.delete.summary', permissions: ['service:delete'] })
  @ApiResponse({ status: 204, description: 'service.response.204' })
  remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.services.remove(id, user, req.tenantId!);
  }
}
