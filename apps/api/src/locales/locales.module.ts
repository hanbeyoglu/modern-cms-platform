import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { LocalesService } from './locales.service';
import { LocalesController } from './locales.controller';

@Module({
  imports: [AccessModule, AuditModule],
  controllers: [LocalesController],
  providers: [LocalesService],
  exports: [LocalesService],
})
export class LocalesModule {}
