import { Body, Controller, Header, Post, Req, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { ApiPublicContext, ApiPublicOperation } from '../swagger/swagger.decorators';
import { PublicApiKeyGuard } from '../public/guards/public-api-key.guard';
import { AnalyticsRateLimitGuard } from './analytics-rate-limit.guard';
import { AnalyticsService } from './analytics.service';
import { TrackAnalyticsDto } from './dto/track-analytics.dto';

@Public()
@Controller('public/analytics')
@ApiTags('Web Sitesi Ölçümleri')
@ApiSecurity('apiKey')
@ApiPublicContext()
@UseGuards(PublicApiKeyGuard, AnalyticsRateLimitGuard)
export class PublicAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}
  @Post('track')
  @Header('Cache-Control', 'no-store')
  @ApiPublicOperation({
    summary: 'Record a website click or view',
    mallRequired: true,
    description:
      'Requires x-api-key, x-tenant-id and x-mall-id. Scope and entity ownership are validated. clientEventId is an optional UUID for retry deduplication. POST never serves cached data. Event time is assigned by the server.',
  })
  @ApiResponse({
    status: 201,
    description: 'Event accepted: { success: true, data: { accepted: true } }',
  })
  @ApiResponse({ status: 429, description: 'IP or tenant rate limit reached' })
  async track(@Req() req: Request, @Body() dto: TrackAnalyticsDto) {
    await this.analytics.track(req, dto);
    return { success: true, data: { accepted: true } };
  }
}
