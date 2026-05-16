import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { StorageProvider } from './storage/storage.provider';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { MediaService } from './media.service';
import { MediaFolderService } from './media-folder.service';
import { MediaController } from './media.controller';
import { MediaGuidelinesController } from './media-guidelines.controller';
import { MediaGuidelinesService } from './media-guidelines.service';
import { CapabilitiesModule } from '../capabilities/capabilities.module';

@Module({
  imports: [AccessModule, AuditModule, CapabilitiesModule],
  controllers: [MediaGuidelinesController, MediaController],
  providers: [
    {
      provide: StorageProvider,
      useFactory: (config: ConfigService): StorageProvider => {
        const storageRoot = config.get<string>('STORAGE_ROOT') ?? join(process.cwd(), 'storage');
        const baseUrl = config.get<string>('API_BASE_URL') ?? 'http://localhost:4000';
        const provider = new LocalStorageProvider({ storageRoot, baseUrl });
        provider.ensureRootExists();
        return provider;
      },
      inject: [ConfigService],
    },
    MediaService,
    MediaFolderService,
    MediaGuidelinesService,
  ],
  exports: [MediaService, MediaFolderService, MediaGuidelinesService],
})
export class MediaModule {}
