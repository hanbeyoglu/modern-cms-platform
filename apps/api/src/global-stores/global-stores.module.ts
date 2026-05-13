import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { GlobalStoresController } from './global-stores.controller';
import { GlobalStoresService } from './global-stores.service';

@Module({
  imports: [AccessModule, AuditModule],
  controllers: [GlobalStoresController],
  providers: [GlobalStoresService],
  exports: [GlobalStoresService],
})
export class GlobalStoresModule {}
