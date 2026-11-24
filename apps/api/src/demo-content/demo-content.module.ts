import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { EventsModule } from '../events/events.module';
import { GlobalStoresModule } from '../global-stores/global-stores.module';
import { MallStoresModule } from '../mall-stores/mall-stores.module';
import { MediaModule } from '../media/media.module';
import { MoviesModule } from '../movies/movies.module';
import { MovieSessionsModule } from '../movie-sessions/movie-sessions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SlidersModule } from '../sliders/sliders.module';
import { StoreCategoriesModule } from '../store-categories/store-categories.module';
import { DemoContentController } from './demo-content.controller';
import { DemoContentService } from './demo-content.service';

@Module({
  imports: [
    PrismaModule,
    AccessModule,
    AuditModule,
    MediaModule,
    GlobalStoresModule,
    MallStoresModule,
    StoreCategoriesModule,
    CampaignsModule,
    EventsModule,
    MoviesModule,
    MovieSessionsModule,
    SlidersModule,
  ],
  controllers: [DemoContentController],
  providers: [DemoContentService],
  exports: [DemoContentService],
})
export class DemoContentModule {}
