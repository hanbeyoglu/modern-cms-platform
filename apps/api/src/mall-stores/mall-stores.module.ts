import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { SearchModule } from '../search/search.module';
import { MallStoresController } from './mall-stores.controller';
import { MallStoresService } from './mall-stores.service';

@Module({
  imports: [AccessModule, AuditModule, SearchModule],
  controllers: [MallStoresController],
  providers: [MallStoresService],
  exports: [MallStoresService],
})
export class MallStoresModule {}
