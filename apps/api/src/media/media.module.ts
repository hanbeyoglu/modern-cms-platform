import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { R2Module } from '../r2/r2.module';
import { R2Service } from '../r2/r2.service';
import { ImageProcessorService } from './image-processor.service';
import { MediaController } from './media.controller';
import { MediaFolderService } from './media-folder.service';
import { MediaGuidelinesController } from './media-guidelines.controller';
import { MediaGuidelinesService } from './media-guidelines.service';
import { MediaService } from './media.service';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { R2StorageProvider } from './storage/r2-storage.provider';
import { StorageProvider } from './storage/storage.provider';

@Module({
  imports: [AccessModule, AuditModule, CapabilitiesModule, R2Module],
  controllers: [MediaGuidelinesController, MediaController],
  providers: [
    {
      provide: StorageProvider,
      useFactory: (config: ConfigService, r2: R2Service): StorageProvider => {
        if (r2.isConfigured()) {
          return new R2StorageProvider(r2);
        }

        const storageRoot = config.get<string>('STORAGE_ROOT') ?? join(process.cwd(), 'storage');
        const baseUrl = config.get<string>('API_BASE_URL') ?? 'http://localhost:4000';
        const provider = new LocalStorageProvider({ storageRoot, baseUrl });
        provider.ensureRootExists();
        return provider;
      },
      inject: [ConfigService, R2Service],
    },
    ImageProcessorService,
    MediaService,
    MediaFolderService,
    MediaGuidelinesService,
  ],
  exports: [MediaService, MediaFolderService, MediaGuidelinesService, StorageProvider],
})
export class MediaModule {}
