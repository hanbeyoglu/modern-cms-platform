import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MallLocalesModule } from '../mall-locales/mall-locales.module';
import { TranslationResolverService } from './translation-resolver.service';

@Module({
  imports: [PrismaModule, MallLocalesModule],
  providers: [TranslationResolverService],
  exports: [TranslationResolverService],
})
export class TranslationResolverModule {}
