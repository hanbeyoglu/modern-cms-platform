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
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequireCapability } from '../capabilities/decorators/require-capability.decorator';
import { LocalesService } from './locales.service';
import { CreateLocaleDto } from './dto/create-locale.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';
import { ListLocalesDto } from './dto/list-locales.dto';
import { ReorderLocalesDto } from './dto/reorder-locales.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.SYSTEM_LOCALES)
@ApiAdminContext()
@Controller('system/locales')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard, CapabilityGuard)
@RequireCapability('localization')
export class SystemLocalesController {
  constructor(private readonly locales: LocalesService) {}

  @Get()
  @RequirePermission('system-language:read')
  @ApiAdminOperation({
    summary: 'systemLanguage.list.summary',
    description: 'systemLanguage.list.description',
    permissions: ['system-language:read'],
    related: [SWAGGER_TAGS.TRANSLATIONS, SWAGGER_TAGS.PUBLIC],
  })
  @ApiResponse({ status: 200, description: 'systemLanguage.response.200' })
  list(@Req() req: Request, @Query() query: ListLocalesDto) {
    return this.locales.list(req.tenantId!, query);
  }

  @Post()
  @RequirePermission('system-language:create')
  @ApiAdminOperation({
    summary: 'systemLanguage.create.summary',
    permissions: ['system-language:create'],
  })
  @ApiResponse({ status: 201, description: 'systemLanguage.response.201' })
  create(@Body() dto: CreateLocaleDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.locales.create(dto, user, req.tenantId!);
  }

  @Patch('reorder')
  @RequirePermission('system-language:update')
  @ApiAdminOperation({
    summary: 'systemLanguage.reorder.summary',
    description: 'systemLanguage.reorder.description',
    permissions: ['system-language:update'],
  })
  @ApiResponse({ status: 200, description: 'systemLanguage.response.200' })
  reorder(@Body() dto: ReorderLocalesDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.locales.reorder(dto.orderedIds, user, req.tenantId!);
  }

  @Patch(':id')
  @RequirePermission('system-language:update')
  @ApiAdminOperation({
    summary: 'systemLanguage.update.summary',
    permissions: ['system-language:update'],
  })
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiResponse({ status: 200, description: 'systemLanguage.response.200' })
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
  @RequirePermission('system-language:delete')
  @ApiAdminOperation({
    summary: 'systemLanguage.deactivate.summary',
    description: 'systemLanguage.deactivate.description',
    permissions: ['system-language:delete'],
  })
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiResponse({ status: 204, description: 'systemLanguage.response.204' })
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.locales.deactivate(id, user, req.tenantId!);
  }

  @Post(':id/default')
  @RequirePermission('system-language:update')
  @ApiAdminOperation({
    summary: 'systemLanguage.setDefault.summary',
    description: 'systemLanguage.setDefault.description',
    permissions: ['system-language:update'],
  })
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiResponse({ status: 200, description: 'systemLanguage.response.200' })
  setDefault(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.locales.setDefault(id, user, req.tenantId!);
  }
}
