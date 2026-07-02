import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { LocalesService } from './locales.service';
import { LocalesController } from './locales.controller';
import { SystemLocalesController } from './system-locales.controller';

@Module({
  imports: [AccessModule, AuditModule, CapabilitiesModule],
  controllers: [LocalesController, SystemLocalesController],
  providers: [LocalesService],
  exports: [LocalesService],
})
export class LocalesModule {}
