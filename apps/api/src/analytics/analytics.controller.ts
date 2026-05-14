import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { RequireMallContext } from '../common/decorators/require-mall.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequireCapability } from '../capabilities/decorators/require-capability.decorator';
import { AnalyticsService } from './analytics.service';
import { TrackAnalyticsDto } from './dto/track-analytics.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('track')
  @Public()
  track(@Req() req: Request, @Body() dto: TrackAnalyticsDto) {
    return this.analytics.track(req, dto);
  }

  @Get('summary')
  @RequireTenantContext()
  @RequireMallContext()
  @UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard, CapabilityGuard)
  @RequirePermission('analytics:view')
  @RequireCapability('analytics')
  summary(@CurrentUser() user: User, @Req() req: Request, @Query() q: AnalyticsQueryDto) {
    return this.analytics.summary(user, req.tenantId!, req.mallId, q);
  }

  @Get('top-content')
  @RequireTenantContext()
  @RequireMallContext()
  @UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard, CapabilityGuard)
  @RequirePermission('analytics:view')
  @RequireCapability('analytics')
  topContent(@CurrentUser() user: User, @Req() req: Request, @Query() q: AnalyticsQueryDto) {
    return this.analytics.topContent(user, req.tenantId!, req.mallId, q);
  }

  @Get('timeseries')
  @RequireTenantContext()
  @RequireMallContext()
  @UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard, CapabilityGuard)
  @RequirePermission('analytics:view')
  @RequireCapability('analytics')
  timeseries(@CurrentUser() user: User, @Req() req: Request, @Query() q: AnalyticsQueryDto) {
    return this.analytics.timeseries(user, req.tenantId!, req.mallId, q);
  }
}
