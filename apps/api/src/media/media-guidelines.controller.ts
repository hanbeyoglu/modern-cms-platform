import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequireCapability } from '../capabilities/decorators/require-capability.decorator';
import { MediaGuidelinesService } from './media-guidelines.service';
import { UpdateMediaGuidelineDto } from './dto/update-media-guideline.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiAdminContext, ApiAdminOperation } from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.MEDIA)
@ApiAdminContext()
@Controller('media/guidelines')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard, CapabilityGuard)
@RequireCapability('media')
export class MediaGuidelinesController {
  constructor(private readonly guidelines: MediaGuidelinesService) {}

  @Get()
  @RequirePermission('media:read')
  @ApiAdminOperation({ summary: 'media.list.summary',
    permissions: ['media:read'],
  })
  @ApiResponse({ status: 200, description: 'media.response.200' })
  list(@Req() req: Request) {
    return this.guidelines.listMerged(req.tenantId!);
  }

  @Patch(':usageKey')
  @RequirePermission('media:update')
  @ApiParam({
    name: 'usageKey',
    description: 'Media usage context key (e.g. campaign-cover, slider-hero)',
    schema: { type: 'string', example: 'campaign-cover' },
  })
  @ApiAdminOperation({ summary: 'media.update.summary',
    permissions: ['media:update'],
  })
  @ApiResponse({ status: 200, description: 'media.response.200' })
  update(
    @Param('usageKey') usageKey: string,
    @Body() dto: UpdateMediaGuidelineDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.guidelines.upsert(usageKey, dto, user, req.tenantId!);
  }
}
