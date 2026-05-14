import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { SearchService } from './search.service';
import { GlobalSearchQueryDto } from './dto/global-search-query.dto';

@Controller('search')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('global')
  @RequirePermission('search:global')
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
