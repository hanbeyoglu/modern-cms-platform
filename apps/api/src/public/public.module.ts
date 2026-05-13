import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicCacheService } from './cache/public-cache.service';
import { PublicContentService } from './public-content.service';
import { PublicContextService } from './public-context.service';
import { PublicController } from './public.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PublicController],
  providers: [PublicContextService, PublicContentService, PublicCacheService],
  exports: [PublicCacheService],
})
export class PublicModule {}
