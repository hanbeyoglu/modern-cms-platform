import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from './access/access.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { HealthModule } from './health/health.module';
import { MallsModule } from './malls/malls.module';
import { MediaModule } from './media/media.module';
import { PrismaModule } from './prisma/prisma.module';
import { SlidersModule } from './sliders/sliders.module';
import { StoreCategoriesModule } from './store-categories/store-categories.module';
import { GlobalStoresModule } from './global-stores/global-stores.module';
import { MallStoresModule } from './mall-stores/mall-stores.module';
import { TenantsModule } from './tenants/tenants.module';
import { EventsModule } from './events/events.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { CinemasModule } from './cinemas/cinemas.module';
import { MoviesModule } from './movies/movies.module';
import { MovieSessionsModule } from './movie-sessions/movie-sessions.module';
import { PagesModule } from './pages/pages.module';
import { PageBlocksModule } from './page-blocks/page-blocks.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local', '../../.env', '../../.env.local'],
    }),
    PrismaModule,
    AuditModule,
    AccessModule,
    AuthModule,
    TenantsModule,
    MallsModule,
    MediaModule,
    SlidersModule,
    StoreCategoriesModule,
    GlobalStoresModule,
    MallStoresModule,
    EventsModule,
    CampaignsModule,
    CinemasModule,
    MoviesModule,
    MovieSessionsModule,
    PagesModule,
    PageBlocksModule,
    AnalyticsModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
