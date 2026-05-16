import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SearchModule } from '../search/search.module';
import { TranslationResolverModule } from '../translation-resolver/translation-resolver.module';
import { MediaModule } from '../media/media.module';
import { PublicCacheService } from './cache/public-cache.service';
import { PublicContentService } from './public-content.service';
import { PublicContextService } from './public-context.service';
import { PublicController } from './public.controller';

@Module({
  imports: [PrismaModule, TranslationResolverModule, SearchModule, MediaModule],
  controllers: [PublicController],
  providers: [PublicContextService, PublicContentService, PublicCacheService],
  exports: [PublicCacheService],
})
export class PublicModule {}
