import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequireCapability } from '../capabilities/decorators/require-capability.decorator';
import { SearchService } from './search.service';
import { GlobalSearchQueryDto } from './dto/global-search-query.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiAdminContext, ApiAdminOperation } from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.SEARCH)
@ApiAdminContext()
@Controller('search')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard, CapabilityGuard)
@RequireCapability('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('global')
  @RequirePermission('search:global')
  @ApiAdminOperation({ summary: 'search.global.admin.search.summary',
    description: 'Search across all content types in the admin panel. Returns grouped hits per entity type.',
    permissions: ['search:global'],
    related: [SWAGGER_TAGS.PUBLIC, SWAGGER_TAGS.CAMPAIGNS, SWAGGER_TAGS.EVENTS, SWAGGER_TAGS.PAGES],
  })
  @ApiQuery({ name: 'q', required: true, description: 'Search query string.' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max hits per group (default 6).', schema: { type: 'integer', default: 6 } })
  @ApiResponse({ status: 200, description: 'search.response.200' })
  global(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Query() query: GlobalSearchQueryDto,
  ) {
    return this.search.globalSearch(
      user,
      req.tenantId!,
      query.q,
      query.limit ?? 6,
      req.mallId ?? null,
    );
  }
}
