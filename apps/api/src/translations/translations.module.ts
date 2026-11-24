import { PublicCacheModule } from '../public/cache/public-cache.module';
import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { SearchModule } from '../search/search.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { TranslationsService } from './translations.service';
import { TranslationsController } from './translations.controller';

@Module({
  imports: [PublicCacheModule, AccessModule, AuditModule, SearchModule, CapabilitiesModule],
  controllers: [TranslationsController],
  providers: [TranslationsService],
  exports: [TranslationsService],
})
export class TranslationsModule {}
