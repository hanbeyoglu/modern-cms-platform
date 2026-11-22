import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PublicCacheService } from './public-cache.service';

/** Shared cache without importing public controllers or translation modules. */
@Module({
  imports: [ConfigModule],
  providers: [PublicCacheService],
  exports: [PublicCacheService],
})
export class PublicCacheModule {}
