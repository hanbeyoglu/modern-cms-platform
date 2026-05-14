import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TranslationResolverModule } from '../translation-resolver/translation-resolver.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { PublicSearchService } from './public-search.service';
import { SearchController } from './search.controller';
import { SearchIndexerService } from './search-indexer.service';
import { SearchNormalizerService } from './search-normalizer.service';
import { SearchQueryBuilder } from './search-query-builder';
import { SearchRankingService } from './search-ranking.service';
import { SearchResultMapperService } from './search-result-mapper.service';
import { SearchService } from './search.service';

@Module({
  imports: [PrismaModule, AccessModule, TranslationResolverModule, CapabilitiesModule],
  controllers: [SearchController],
  providers: [
    SearchNormalizerService,
    SearchQueryBuilder,
    SearchRankingService,
    SearchResultMapperService,
    SearchIndexerService,
    SearchService,
    PublicSearchService,
  ],
  exports: [SearchIndexerService, PublicSearchService],
})
export class SearchModule {}
