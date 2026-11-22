import { join } from 'node:path';
import { Logger, Module } from '@nestjs/common';
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
import { MediaUrlResolver } from './media-url.resolver';
import {
  isObjectStorageConfigured,
  isObjectStorageRequired,
} from './object-storage.config';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { R2StorageProvider } from './storage/r2-storage.provider';
import { StorageProvider } from './storage/storage.provider';
import { isLocalLikeMediaUrl } from './media-url';

@Module({
  imports: [AccessModule, AuditModule, CapabilitiesModule, R2Module],
  controllers: [MediaGuidelinesController, MediaController],
  providers: [
    {
      provide: StorageProvider,
      useFactory: (config: ConfigService, r2: R2Service): StorageProvider => {
        const logger = new Logger('MediaModule');
        if (isObjectStorageConfigured(config)) {
          logger.log('Object storage (R2) selected for media uploads');
          return new R2StorageProvider(r2);
        }

        if (isObjectStorageRequired(config)) {
          throw new Error(
            'Object storage is required (set R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL). ' +
              'For emergency local disk only, set MEDIA_ALLOW_LOCAL_STORAGE=true.',
          );
        }

        const storageRoot = config.get<string>('STORAGE_ROOT') ?? join(process.cwd(), 'storage');
        const baseUrl = config.get<string>('API_BASE_URL') ?? 'http://localhost:4000';
        if (isLocalLikeMediaUrl(baseUrl) && config.get<string>('NODE_ENV') === 'production') {
          throw new Error(
            'API_BASE_URL must be a publicly reachable HTTPS origin when using local media storage in production.',
          );
        }
        logger.warn('Object storage not configured — using local disk fallback (dev only)');
        const provider = new LocalStorageProvider({ storageRoot, baseUrl });
        provider.ensureRootExists();
        return provider;
      },
      inject: [ConfigService, R2Service],
    },
    ImageProcessorService,
    MediaUrlResolver,
    MediaService,
    MediaFolderService,
    MediaGuidelinesService,
  ],
  exports: [
    MediaService,
    MediaFolderService,
    MediaGuidelinesService,
    MediaUrlResolver,
    StorageProvider,
  ],
})
export class MediaModule {}
