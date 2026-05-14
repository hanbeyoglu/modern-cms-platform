import { Module } from '@nestjs/common';
import { TranslationResolverService } from './translation-resolver.service';

@Module({
  providers: [TranslationResolverService],
  exports: [TranslationResolverService],
})
export class TranslationResolverModule {}
