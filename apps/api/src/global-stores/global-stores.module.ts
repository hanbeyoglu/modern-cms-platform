import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { SearchModule } from '../search/search.module';
import { GlobalStoresController } from './global-stores.controller';
import { GlobalStoresService } from './global-stores.service';

@Module({
  imports: [AccessModule, AuditModule, SearchModule],
  controllers: [GlobalStoresController],
  providers: [GlobalStoresService],
  exports: [GlobalStoresService],
})
export class GlobalStoresModule {}
