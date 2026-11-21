import { ContactMessagesModule } from '../contact-messages/contact-messages.module';
import { PublicContactMessagesController } from './public-contact-messages.controller';
import { ContactRateLimitGuard } from './guards/contact-rate-limit.guard';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SearchModule } from '../search/search.module';
import { TranslationResolverModule } from '../translation-resolver/translation-resolver.module';
import { MediaModule } from '../media/media.module';
import { PublicCacheService } from './cache/public-cache.service';
import { PublicContentService } from './public-content.service';
import { PublicContextService } from './public-context.service';
import { PublicController } from './public.controller';
import { MallLocalesModule } from '../mall-locales/mall-locales.module';
import { DeveloperApiModule } from '../developer-api/developer-api.module';
import { PublicApiKeyGuard } from './guards/public-api-key.guard';

@Module({
  imports: [ContactMessagesModule, PrismaModule, TranslationResolverModule, MallLocalesModule, SearchModule, MediaModule, DeveloperApiModule],
  controllers: [PublicController, PublicContactMessagesController],
  providers: [ContactRateLimitGuard, PublicContextService, PublicContentService, PublicCacheService, PublicApiKeyGuard],
  exports: [PublicCacheService],
})
export class PublicModule {}
