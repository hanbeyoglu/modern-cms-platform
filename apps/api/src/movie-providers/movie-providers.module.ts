import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { SearchModule } from '../search/search.module';
import { MovieProviderRegistryService } from './movie-provider-registry.service';
import { MovieImportService } from './movie-import.service';
import { MovieSyncService } from './movie-sync.service';
import { MovieSyncQueueService } from './movie-sync-queue.service';
import { MovieImportQueueService } from './movie-import-queue.service';
import { MovieProvidersController } from './movie-providers.controller';
import { MovieProvidersSettingsService } from './movie-providers-settings.service';

@Module({
  imports: [AccessModule, AuditModule, SearchModule],
  controllers: [MovieProvidersController],
  providers: [
    MovieProviderRegistryService,
    MovieImportService,
    MovieSyncService,
    MovieSyncQueueService,
    MovieImportQueueService,
    MovieProvidersSettingsService,
  ],
  exports: [
    MovieProviderRegistryService,
    MovieImportService,
    MovieSyncService,
    MovieSyncQueueService,
    MovieImportQueueService,
    MovieProvidersSettingsService,
  ],
})
export class MovieProvidersModule {}
