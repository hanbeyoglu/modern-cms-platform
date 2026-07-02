import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiPublicContext,
  ApiPublicOperation,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.ANALYTICS)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('track')
  @Public()
  @ApiPublicContext()
  @ApiPublicOperation({ summary: 'public.track.analytics.event.summary',
    description:
      'Public ingestion endpoint for page views, clicks, and impressions. No JWT required — send `x-tenant-id` header.',
    related: [SWAGGER_TAGS.PUBLIC],
  })
  @ApiResponse({ status: 201, description: 'analytics.response.201' })
  track(@Req() req: Request, @Body() dto: TrackAnalyticsDto) {
    return this.analytics.track(req, dto);
  }

  @Get('summary')
  @RequireTenantContext()
  @RequireMallContext()
  @UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard, CapabilityGuard)
  @RequirePermission('analytics:view')
  @RequireCapability('analytics')
  @ApiAdminContext()
  @ApiAdminOperation({ summary: 'analytics.get.summary',
    description: 'Aggregated KPIs (views, clicks, unique visitors) for the selected date range.',
    permissions: ['analytics:view'],
    related: [SWAGGER_TAGS.DASHBOARD],
  })
  @ApiResponse({ status: 200, description: 'analytics.response.200' })
  summary(@CurrentUser() user: User, @Req() req: Request, @Query() q: AnalyticsQueryDto) {
    return this.analytics.summary(user, req.tenantId!, req.mallId, q);
  }

  @Get('top-content')
  @RequireTenantContext()
  @RequireMallContext()
  @UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard, CapabilityGuard)
  @RequirePermission('analytics:view')
  @RequireCapability('analytics')
  @ApiAdminContext()
  @ApiAdminOperation({ summary: 'analytics.get.summary',
    description: 'Ranked list of most viewed or clicked content entities in the date range.',
    permissions: ['analytics:view'],
  })
  @ApiResponse({ status: 200, description: 'analytics.response.200' })
  topContent(@CurrentUser() user: User, @Req() req: Request, @Query() q: AnalyticsQueryDto) {
    return this.analytics.topContent(user, req.tenantId!, req.mallId, q);
  }

  @Get('timeseries')
  @RequireTenantContext()
  @RequireMallContext()
  @UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard, CapabilityGuard)
  @RequirePermission('analytics:view')
  @RequireCapability('analytics')
  @ApiAdminContext()
  @ApiAdminOperation({ summary: 'analytics.get.summary',
    description: 'Daily or hourly time-series data for charting views and engagement over time.',
    permissions: ['analytics:view'],
  })
  @ApiResponse({ status: 200, description: 'analytics.response.200' })
  timeseries(@CurrentUser() user: User, @Req() req: Request, @Query() q: AnalyticsQueryDto) {
    return this.analytics.timeseries(user, req.tenantId!, req.mallId, q);
  }
}
