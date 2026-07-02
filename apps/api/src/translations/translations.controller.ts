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
import { TranslationsService } from './translations.service';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
import { ListTranslationsDto } from './dto/list-translations.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiPaginationQuery,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.TRANSLATIONS)
@ApiAdminContext()
@Controller('translations')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard, CapabilityGuard)
@RequireCapability('localization')
export class TranslationsController {
  constructor(private readonly translations: TranslationsService) {}

  @Get()
  @RequirePermission('translation:read')
  @ApiAdminOperation({ summary: 'translation.list.summary',
    description: 'Paginated list of translation keys and values for the tenant.',
    permissions: ['translation:read'],
    related: [SWAGGER_TAGS.LOCALES],
  })
  @ApiPaginationQuery()
  @ApiResponse({ status: 200, description: 'translation.response.200' })
  list(@Req() req: Request, @Query() query: ListTranslationsDto) {
    return this.translations.list(req.tenantId!, query);
  }

  @Post()
  @RequirePermission('translation:create')
  @ApiAdminOperation({ summary: 'translation.create.summary',
    description: 'Creates a new translation key or updates the value if the key already exists.',
    permissions: ['translation:create'],
  })
  @ApiResponse({ status: 201, description: 'translation.response.201' })
  upsert(@Body() dto: CreateTranslationDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.translations.upsert(dto, user, req.tenantId!);
  }

  @Patch(':id')
  @RequirePermission('translation:update')
  @ApiAdminOperation({ summary: 'translation.update.summary',
    permissions: ['translation:update'],
  })
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiResponse({ status: 200, description: 'translation.response.200' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTranslationDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.translations.update(id, dto, user, req.tenantId!);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('translation:delete')
  @ApiAdminOperation({ summary: 'translation.delete.summary',
    permissions: ['translation:delete'],
  })
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiResponse({ status: 204, description: 'translation.response.204' })
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.translations.remove(id, user, req.tenantId!);
  }
}
