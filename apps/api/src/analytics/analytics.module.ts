import { PublicModule } from '../public/public.module';
import { DeveloperApiModule } from '../developer-api/developer-api.module';
import { PublicApiKeyGuard } from '../public/guards/public-api-key.guard';
import { AnalyticsRateLimitGuard } from './analytics-rate-limit.guard';
import { PublicAnalyticsController } from './public-analytics.controller';
import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [PublicModule, DeveloperApiModule, AccessModule, PrismaModule, CapabilitiesModule],
  controllers: [AnalyticsController, PublicAnalyticsController],
  providers: [AnalyticsService, PublicApiKeyGuard, AnalyticsRateLimitGuard],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
