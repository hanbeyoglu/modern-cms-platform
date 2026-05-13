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

@Module({
  imports: [AccessModule, AuditModule],
  controllers: [MediaController],
  providers: [
    {
      provide: StorageProvider,
      useFactory: (config: ConfigService): StorageProvider => {
        const storageRoot = config.get<string>('STORAGE_ROOT') ?? join(process.cwd(), 'storage');
        const baseUrl =
          config.get<string>('API_BASE_URL') ?? 'http://localhost:4000';
        const provider = new LocalStorageProvider({ storageRoot, baseUrl });
        provider.ensureRootExists();
        return provider;
      },
      inject: [ConfigService],
    },
    MediaService,
    MediaFolderService,
  ],
  exports: [MediaService, MediaFolderService],
})
export class MediaModule {}
